export class AcceptInviteResponseDto {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  tenant: {
    id: string;
    company_name: string;
  };
  role: string;
}
