import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export const videoApi = axios.create({ baseURL: `${apiBaseUrl}/api/video` });
export const realtimeUrl = apiBaseUrl || window.location.origin;
