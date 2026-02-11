'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import type { Tenant } from '@/lib/types/twilio-admin';

interface TenantSelectorProps {
  tenants: Tenant[];
  selectedTenantId: string | null;
  onSelect: (tenantId: string) => void;
  loading?: boolean;
}

export function TenantSelector({
  tenants,
  selectedTenantId,
  onSelect,
  loading = false,
}: TenantSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredTenants = tenants.filter(
    (t) =>
      t.company_name.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Tenant</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name or subdomain..."
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Select value={selectedTenantId || ''} onValueChange={onSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tenant to assist" />
              </SelectTrigger>
              <SelectContent>
                {filteredTenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    <div>
                      <p className="font-medium">{tenant.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.subdomain}.lead360.app
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
