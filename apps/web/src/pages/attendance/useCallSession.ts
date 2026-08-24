import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Room, RoomEvent, RemoteTrack, RemoteTrackPublication, RemoteParticipant, Track } from "livekit-client";
import { videoApi, realtimeUrl } from "../../lib/videoApi";
import { getAgentSession } from "../../lib/agentAuth";
import type { CallState, Role } from "./types";

interface UseCallSessionParams {
  collectionId: string;
  role: Role;
  // Só o CLIENT usa token (vem da URL). O AGENT autentica via sessão do painel
  // (header Authorization, anexado automaticamente pelo videoApi).
  token?: string;
}

export function useCallSession({ collectionId, token, role }: UseCallSessionParams) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [peerConnected, setPeerConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  // A maioria dos navegadores mobile (especialmente Safari/iOS) não suporta
  // compartilhar tela numa página web comum — escondemos o botão nesses casos
  // em vez de deixar um controle que não funciona.
  const [screenShareSupported] = useState(() => Boolean(navigator.mediaDevices?.getDisplayMedia));
  // true quando o OUTRO participante está compartilhando a tela — o vídeo principal
  // passa a mostrar a tela dele em vez da câmera enquanto isso durar.
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  // true só depois que o vídeo do OUTRO participante é de fato recebido — evita mostrar
  // uma tela preta "muda" quando a chamada já está "active" mas o outro lado ainda não
  // publicou a câmera (permissão lenta, rede ruim etc.).
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const livekitCredsRef = useRef<{ url: string; jwt: string } | null>(null);
  // A câmera e a tela compartilhada do outro participante são dois tracks de vídeo
  // separados — guardamos os dois e decidimos qual anexar ao <video> principal
  // (tela compartilhada tem prioridade sobre a câmera).
  const remoteCameraTrackRef = useRef<RemoteTrack | null>(null);
  const remoteScreenTrackRef = useRef<RemoteTrack | null>(null);

  function renderRemoteVideo() {
    if (!remoteVideoRef.current) return;
    const track = remoteScreenTrackRef.current ?? remoteCameraTrackRef.current;
    if (track) {
      track.attach(remoteVideoRef.current);
      setRemoteVideoActive(true);
    } else {
      setRemoteVideoActive(false);
    }
    setRemoteScreenSharing(Boolean(remoteScreenTrackRef.current));
  }

  useEffect(() => {
    if (!collectionId) return;
    if (role === "CLIENT" && !token) return;
    let cancelled = false;

    videoApi
      .post(`/${collectionId}/token`, token ? { token } : {})
      .then(({ data }) => {
        if (cancelled) return;
        livekitCredsRef.current = { url: data.livekitUrl, jwt: data.livekitToken };
        setClientName(data.collection?.clientName ?? "");
      })
      .catch(() => {
        if (!cancelled) setConnectionError("Não foi possível preparar a videochamada.");
      });

    const socket = io(realtimeUrl, {
      path: "/realtime",
      query:
        role === "AGENT"
          ? { collectionId, agentSession: getAgentSession() ?? "" }
          : { collectionId, token: token ?? "" },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setCallState((s) => (s === "idle" ? "waiting_peer" : s)));
    socket.on("connect_error", () => setConnectionError("Não foi possível conectar à sala de atendimento."));

    socket.on("client_joined", () => role === "AGENT" && setPeerConnected(true));
    socket.on("client_left", () => role === "AGENT" && setPeerConnected(false));
    socket.on("agent_joined", () => role === "CLIENT" && setPeerConnected(true));
    socket.on("agent_left", () => role === "CLIENT" && setPeerConnected(false));

    socket.on("call_incoming", () => setCallState((s) => (s === "active" ? s : "incoming")));
    socket.on("call_accepted", () => connectLiveKit());
    socket.on("call_declined", () => setCallState("waiting_peer"));
    socket.on("call_ended", () => disconnectLiveKit());

    return () => {
      cancelled = true;
      socket.disconnect();
      roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, token, role]);

  const connectLiveKit = useCallback(async () => {
    // Evita reconectar (e perder os tracks já anexados) se um segundo "call_accepted"
    // chegar enquanto já estamos conectados/conectando — pode acontecer se o socket
    // reconectar sozinho (rede instável) e o servidor reemitir o evento.
    if (roomRef.current) return;
    setCallState("connecting");
    setMediaError(null);
    try {
      if (!livekitCredsRef.current) {
        const { data } = await videoApi.post(`/${collectionId}/token`, token ? { token } : {});
        livekitCredsRef.current = { url: data.livekitUrl, jwt: data.livekitToken };
      }
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) remoteScreenTrackRef.current = track;
          else remoteCameraTrackRef.current = track;
          renderRemoteVideo();
        }
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
        if (track.kind !== Track.Kind.Video) return;
        if (pub.source === Track.Source.ScreenShare) remoteScreenTrackRef.current = null;
        else remoteCameraTrackRef.current = null;
        renderRemoteVideo();
      });
      room.on(RoomEvent.Disconnected, () => {
        remoteCameraTrackRef.current = null;
        remoteScreenTrackRef.current = null;
        setRemoteVideoActive(false);
        setRemoteScreenSharing(false);
        setCallState("ended");
      });

      await room.connect(livekitCredsRef.current.url, livekitCredsRef.current.jwt);
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);

      const camPub = room.localParticipant.videoTrackPublications.values().next().value;
      if (camPub?.track && localVideoRef.current) camPub.track.attach(localVideoRef.current);

      setCallState("active");
    } catch (err) {
      console.error(err);
      roomRef.current?.disconnect();
      roomRef.current = null;
      setMediaError(
        "Não conseguimos acessar sua câmera ou microfone. Verifique as permissões do navegador e tente novamente."
      );
      setCallState("incoming");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, token]);

  function disconnectLiveKit() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    remoteCameraTrackRef.current = null;
    remoteScreenTrackRef.current = null;
    setRemoteVideoActive(false);
    setRemoteScreenSharing(false);
    setCallState("ended");
  }

  function acceptCall() {
    socketRef.current?.emit("call_accept");
  }

  function declineCall() {
    socketRef.current?.emit("call_decline");
    setCallState("waiting_peer");
  }

  function endCall() {
    socketRef.current?.emit("call_end");
    disconnectLiveKit();
  }

  function toggleMic() {
    const next = !micEnabled;
    roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }

  function toggleCam() {
    const next = !camEnabled;
    roomRef.current?.localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
  }

  async function toggleScreenShare() {
    const next = !screenShareEnabled;
    if (next && !navigator.mediaDevices?.getDisplayMedia) {
      setMediaError("Esse navegador/dispositivo não permite compartilhar a tela (comum em celulares).");
      return;
    }
    try {
      await roomRef.current?.localParticipant.setScreenShareEnabled(next, { audio: true });
      setScreenShareEnabled(next);
      setMediaError(null);
    } catch {
      // Se o usuário só fechou o seletor de tela sem escolher nada, não é erro de verdade.
      if (next) setMediaError("Não foi possível compartilhar a tela. Verifique as permissões do navegador.");
    }
  }

  return {
    callState,
    peerConnected,
    micEnabled,
    camEnabled,
    screenShareEnabled,
    screenShareSupported,
    remoteScreenSharing,
    mediaError,
    connectionError,
    clientName,
    remoteVideoActive,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCam,
    toggleScreenShare,
  };
}
