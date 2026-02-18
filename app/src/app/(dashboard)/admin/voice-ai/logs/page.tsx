'use client';
import { redirect } from 'next/navigation';

/** Sprint FSA05 specified /admin/voice-ai/logs — redirect to canonical /admin/voice-ai/call-logs */
export default function VoiceAiLogsRedirectPage() {
  redirect('/admin/voice-ai/call-logs');
}
