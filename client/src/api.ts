import type {
  DayParticipantsResponse,
  EventInfo,
  ParticipantDetail,
} from './types';

const BASE = '/api';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  getEvent: () => getJson<EventInfo>('/event'),
  getDayParticipants: (date: string) =>
    getJson<DayParticipantsResponse>(`/event/days/${date}/participants`),
  getAllDaysParticipants: () =>
    getJson<DayParticipantsResponse>('/event/all/participants'),
  getParticipant: (id: string, date?: string) => {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return getJson<ParticipantDetail>(`/participants/${id}${q}`);
  },
};
