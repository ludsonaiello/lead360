export class RoleDto {
  id: string;
  name: string;
}

export class InvitedByDto {
  id: string;
  first_name: string;
  last_name: string;
}

export class MembershipResponseDto {
  id: string;              // membership UUID
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: RoleDto;
  status: string;          // 'INVITED' | 'ACTIVE' | 'INACTIVE'
  joined_at: string | null;  // ISO datetime
  left_at: string | null;    // ISO datetime
  invited_by: InvitedByDto | null;
  created_at: string;
}

export class PaginatedMembershipsDto {
  data: MembershipResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
