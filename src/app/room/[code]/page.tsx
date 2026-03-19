import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRoomByCode } from '../../../lib/rooms';
import RoomClient from './RoomClient';
import { createClient } from '@supabase/supabase-js';

export default async function RoomPage({ params }: { params: { code: string } }) {
  const { data: room, error } = await getRoomByCode(params.code);
  
  if (error || !room) {
    redirect('/');
  }

  const cookieStore = cookies();
  const userId = cookieStore.get('chaos_user_id')?.value;
  const accessToken = cookieStore.get('chaos_access_token')?.value;

  if (!userId || !accessToken) {
    redirect(`/room/${params.code}/join`);
  }

  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  const { data: sessionData } = await supabaseServer
    .from('sessions')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!sessionData) {
    redirect(`/room/${params.code}/join`);
  }

  return <RoomClient room={room} userId={userId} />;
}
