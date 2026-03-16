export class InviteTokenInfoDto {
  tenant_name: string;
  role_name: string;
  invited_by_name: string;
  email: string;
  expires_at: string; // ISO datetime
}
