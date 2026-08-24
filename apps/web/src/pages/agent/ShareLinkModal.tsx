import { useState } from "react";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface ShareLinkModalProps {
  clientName: string;
  link: string;
  onClose: () => void;
}

export function ShareLinkModal({ clientName, link, onClose }: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard pode ser bloqueado — o campo de texto abaixo já permite copiar manualmente */
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Olá! Segue o link do seu atendimento: ${link}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-slate-900">Link de {clientName}</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 break-all">
          {link}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="md" className="flex-1" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex-1">
            <Button size="md" className="w-full">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
