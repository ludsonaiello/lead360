import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { QuotesModule } from '../quotes/quotes.module';
import { LeadsModule } from '../leads/leads.module';
import { FinancialModule } from '../financial/financial.module';
import { CrewMemberController } from './controllers/crew-member.controller';
import { CrewMemberService } from './services/crew-member.service';
import { SubcontractorController } from './controllers/subcontractor.controller';
import { SubcontractorService } from './services/subcontractor.service';
import { ProjectTemplateController } from './controllers/project-template.controller';
import { ProjectTemplateService } from './services/project-template.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectService } from './services/project.service';
import { ProjectNumberGeneratorService } from './services/project-number-generator.service';
import { ProjectActivityService } from './services/project-activity.service';
import { ProjectDocumentController } from './controllers/project-document.controller';
import { ProjectDocumentService } from './services/project-document.service';
import { ProjectPhotoController } from './controllers/project-photo.controller';
import { ProjectPhotoService } from './services/project-photo.service';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    AuditModule,
    FilesModule,
    QuotesModule,
    LeadsModule,
    FinancialModule,
  ],
  controllers: [
    CrewMemberController,
    SubcontractorController,
    ProjectTemplateController,
    ProjectController,
    ProjectDocumentController,
    ProjectPhotoController,
  ],
  providers: [
    CrewMemberService,
    SubcontractorService,
    ProjectTemplateService,
    ProjectService,
    ProjectNumberGeneratorService,
    ProjectActivityService,
    ProjectDocumentService,
    ProjectPhotoService,
  ],
  exports: [
    CrewMemberService,
    SubcontractorService,
    ProjectTemplateService,
    ProjectService,
    ProjectNumberGeneratorService,
    ProjectActivityService,
    ProjectDocumentService,
    ProjectPhotoService,
  ],
})
export class ProjectsModule {}
