export class MembershipDetailDto {
  id: string;
  tenant_id: string;
  role: { id: string; name: string };
  status: string;
  joined_at: string | null;
}

export class UserMeResponseDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  membership: MembershipDetailDto;
}
