import { Global, Module } from '@nestjs/common';
import { TemplateVariableRegistryService } from './services/template-variable-registry.service';

/**
 * Shared Module
 *
 * Global module that provides shared services across the entire application.
 * Services here are available to all modules without explicit imports.
 */
@Global()
@Module({
  providers: [TemplateVariableRegistryService],
  exports: [TemplateVariableRegistryService],
})
export class SharedModule {}
