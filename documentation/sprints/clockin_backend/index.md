# Sprints — Time Clock Backend

| Sprint | Title | Endpoints | Depends On |
|---|---|---|---|
| 1 | Prisma Schema + Migration | 0 | None |
| 2 | RBAC Seed + Module Scaffold + AppModule Registration | 0 | 1 |
| 3 | Settings DTOs + Service + Controller | 3 | 2 |
| 4 | Employee Profiles DTOs + Service + Controller | 7 | 3 |
| 5 | Clock-In Addresses CRUD + Import + GeofenceService | 7 | 2 |
| 6 | Employee-Project Assignments | 3 | 4 |
| 7 | Work Shifts CRUD + Bulk + /mine | 7 | 4 |
| 8 | OvertimeService + LaborCostAttributionService | 0 | 2 |
| 9 | Clock Sessions — Clock-In/Out + Core Endpoints | 8 | 4, 5, 7, 8 |
| 10 | Break Endpoints | 3 | 9 |
| 11 | ClockSessionEditService + Manual Edit | 1 | 9 |
| 12 | Disputes Lifecycle | 7 | 11 |
| 13 | Kiosk Guard + Kiosk Endpoints | 3 | 9 |
| 14 | Background Jobs — Missed Shift + Shift Reminder | 0 + 2 jobs | 7 |
| 15 | Dashboard + Reports + Payroll CSV Export | 7 | 9, 11 |
| 16 | API Documentation | 0 | 1–15 |
| | **Total** | **57 + 2 jobs + docs** | |
