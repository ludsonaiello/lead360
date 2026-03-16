export class InviteResponseDto {
  id: string;         // membership UUID
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: { id: string; name: string };
  status: string;     // 'INVITED'
  created_at: string;
}
