```mermaid
erDiagram

        audit_log_actor_type {
            user user
system system
platform_admin platform_admin
cron_job cron_job
        }
    


        audit_log_status {
            success success
failure failure
        }
    


        communication_provider_type {
            email email
sms sms
call call
whatsapp whatsapp
        }
    


        communication_channel {
            email email
sms sms
whatsapp whatsapp
        }
    


        communication_direction {
            outbound outbound
inbound inbound
        }
    


        communication_status {
            pending pending
sent sent
delivered delivered
failed failed
bounced bounced
        }
    


        email_template_category {
            system system
transactional transactional
marketing marketing
notification notification
        }
    


        email_template_type {
            platform platform
shared shared
tenant tenant
        }
    


        notification_recipient_type {
            owner owner
assigned_user assigned_user
specific_users specific_users
all_users all_users
        }
    


        quote_status {
            draft draft
pending_approval pending_approval
ready ready
sent sent
read read
approved approved
denied denied
lost lost
        }
    


        attachment_type {
            cover_photo cover_photo
full_page_photo full_page_photo
grid_photo grid_photo
url_attachment url_attachment
        }
    


        grid_layout {
            grid_2 grid_2
grid_4 grid_4
grid_6 grid_6
        }
    


        approval_status {
            pending pending
approved approved
rejected rejected
        }
    


        discount_rule_type {
            percentage percentage
fixed_amount fixed_amount
        }
    


        discount_apply_to {
            subtotal subtotal
total total
        }
    


        warranty_price_type {
            fixed fixed
percentage percentage
        }
    


        draw_calculation_type {
            percentage percentage
fixed_amount fixed_amount
        }
    


        device_type {
            desktop desktop
mobile mobile
tablet tablet
unknown unknown
        }
    
  "audit_log" {
    String id "🗝️"
    audit_log_actor_type actor_type 
    String entity_type 
    String entity_id 
    String description 
    String action_type 
    String before_json "❓"
    String after_json "❓"
    String metadata_json "❓"
    String ip_address "❓"
    String user_agent "❓"
    audit_log_status status 
    String error_message "❓"
    DateTime created_at 
    }
  

  "file" {
    String id "🗝️"
    String file_id 
    String original_filename 
    String mime_type 
    Int size_bytes 
    Int original_size_bytes "❓"
    String category 
    String storage_path 
    String storage_provider 
    String s3_bucket "❓"
    String s3_key "❓"
    String s3_region "❓"
    String entity_type "❓"
    String entity_id "❓"
    Boolean is_orphan 
    DateTime orphaned_at "❓"
    Boolean is_trashed 
    DateTime trashed_at "❓"
    Boolean has_thumbnail 
    String thumbnail_path "❓"
    String thumbnail_s3_key "❓"
    Boolean is_optimized 
    Int optimization_quality "❓"
    Int width "❓"
    Int height "❓"
    Int page_count "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "license_type" {
    String id "🗝️"
    String name 
    String description "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "industry" {
    String id "🗝️"
    String name 
    String description "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_industry" {
    String id "🗝️"
    DateTime created_at 
    }
  

  "module" {
    String id "🗝️"
    String name 
    String display_name 
    String description "❓"
    Boolean is_active 
    Int sort_order 
    String icon "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "permission" {
    String id "🗝️"
    String action 
    String display_name 
    String description "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "refresh_token" {
    String id "🗝️"
    String token_hash 
    String device_name "❓"
    String ip_address "❓"
    String user_agent "❓"
    DateTime expires_at 
    DateTime created_at 
    DateTime revoked_at "❓"
    }
  

  "role" {
    String id "🗝️"
    String name 
    String description "❓"
    Boolean is_system 
    DateTime created_at 
    DateTime updated_at 
    Boolean is_active 
    String created_by_user_id "❓"
    DateTime deleted_at "❓"
    }
  

  "role_permission" {
    String id "🗝️"
    DateTime granted_at 
    String granted_by_user_id "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "role_template" {
    String id "🗝️"
    String name 
    String description "❓"
    Boolean is_system_template 
    Boolean is_active 
    String created_by_user_id "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "role_template_permission" {
    String id "🗝️"
    DateTime created_at 
    }
  

  "service" {
    String id "🗝️"
    String name 
    String slug 
    String description "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "subscription_plan" {
    String id "🗝️"
    String name 
    String description "❓"
    Decimal monthly_price 
    Decimal annual_price 
    Int max_users 
    Decimal max_storage_gb "❓"
    Boolean offers_trial 
    Int trial_days "❓"
    String feature_flags 
    Boolean is_active 
    Boolean is_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant" {
    String id "🗝️"
    String subdomain 
    String company_name 
    Boolean is_active 
    String legal_business_name 
    String dba_name "❓"
    String business_entity_type 
    String state_of_registration 
    DateTime date_of_incorporation "❓"
    String ein 
    String state_tax_id "❓"
    String sales_tax_permit "❓"
    String primary_contact_phone 
    String secondary_phone "❓"
    String primary_contact_email 
    String support_email "❓"
    String billing_email "❓"
    String website_url "❓"
    String instagram_url "❓"
    String facebook_url "❓"
    String tiktok_url "❓"
    String youtube_url "❓"
    String bank_name "❓"
    String routing_number "❓"
    String account_number "❓"
    String account_type "❓"
    String venmo_username "❓"
    String primary_brand_color "❓"
    String secondary_brand_color "❓"
    String accent_color "❓"
    String invoice_prefix 
    Int next_invoice_number 
    String quote_prefix 
    Int next_quote_number 
    Int default_quote_validity_days 
    String default_quote_terms "❓"
    String default_quote_footer "❓"
    String default_invoice_footer "❓"
    String default_payment_instructions "❓"
    String timezone 
    String subscription_status 
    DateTime trial_end_date "❓"
    String billing_cycle "❓"
    DateTime next_billing_date "❓"
    DateTime created_at 
    DateTime updated_at 
    DateTime deleted_at "❓"
    Decimal default_contingency_rate "❓"
    Decimal default_overhead_rate "❓"
    Decimal default_profit_margin "❓"
    Decimal sales_tax_rate "❓"
    Json approval_thresholds "❓"
    Json profitability_thresholds "❓"
    String business_size "❓"
    }
  

  "tenant_address" {
    String id "🗝️"
    String address_type 
    String line1 
    String line2 "❓"
    String city 
    String state 
    String zip_code 
    String country 
    Decimal lat "❓"
    Decimal long "❓"
    Boolean is_po_box 
    Boolean is_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_business_hours" {
    String id "🗝️"
    Boolean monday_closed 
    String monday_open1 "❓"
    String monday_close1 "❓"
    String monday_open2 "❓"
    String monday_close2 "❓"
    Boolean tuesday_closed 
    String tuesday_open1 "❓"
    String tuesday_close1 "❓"
    String tuesday_open2 "❓"
    String tuesday_close2 "❓"
    Boolean wednesday_closed 
    String wednesday_open1 "❓"
    String wednesday_close1 "❓"
    String wednesday_open2 "❓"
    String wednesday_close2 "❓"
    Boolean thursday_closed 
    String thursday_open1 "❓"
    String thursday_close1 "❓"
    String thursday_open2 "❓"
    String thursday_close2 "❓"
    Boolean friday_closed 
    String friday_open1 "❓"
    String friday_close1 "❓"
    String friday_open2 "❓"
    String friday_close2 "❓"
    Boolean saturday_closed 
    String saturday_open1 "❓"
    String saturday_close1 "❓"
    String saturday_open2 "❓"
    String saturday_close2 "❓"
    Boolean sunday_closed 
    String sunday_open1 "❓"
    String sunday_close1 "❓"
    String sunday_open2 "❓"
    String sunday_close2 "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_custom_hours" {
    String id "🗝️"
    DateTime date 
    String reason 
    Boolean closed 
    DateTime created_at 
    DateTime updated_at 
    String close_time1 "❓"
    String close_time2 "❓"
    String open_time1 "❓"
    String open_time2 "❓"
    }
  

  "tenant_insurance" {
    String id "🗝️"
    String gl_insurance_provider "❓"
    String gl_policy_number "❓"
    Decimal gl_coverage_amount "❓"
    DateTime gl_effective_date "❓"
    DateTime gl_expiry_date "❓"
    String wc_insurance_provider "❓"
    String wc_policy_number "❓"
    Decimal wc_coverage_amount "❓"
    DateTime wc_effective_date "❓"
    DateTime wc_expiry_date "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_license" {
    String id "🗝️"
    String custom_license_type "❓"
    String license_number 
    String issuing_state 
    DateTime issue_date "❓"
    DateTime expiry_date 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_payment_terms" {
    String id "🗝️"
    String terms_json 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_service" {
    String id "🗝️"
    DateTime created_at 
    }
  

  "tenant_service_area" {
    String id "🗝️"
    String type 
    String value 
    Decimal latitude 
    Decimal longitude 
    Decimal radius_miles "❓"
    String state "❓"
    DateTime created_at 
    DateTime updated_at 
    String city_name "❓"
    Boolean entire_state 
    String zipcode "❓"
    }
  

  "user" {
    String id "🗝️"
    String email 
    String password_hash 
    String first_name 
    String last_name 
    String phone "❓"
    Boolean is_active 
    Boolean is_platform_admin 
    Boolean email_verified 
    DateTime email_verified_at "❓"
    String activation_token "❓"
    DateTime activation_token_expires "❓"
    String password_reset_token "❓"
    DateTime password_reset_expires "❓"
    DateTime last_login_at "❓"
    Boolean mfa_enabled 
    String mfa_secret "❓"
    String oauth_provider "❓"
    String oauth_provider_id "❓"
    DateTime created_at 
    DateTime updated_at 
    DateTime deleted_at "❓"
    }
  

  "user_role" {
    String id "🗝️"
    DateTime created_at 
    DateTime assigned_at 
    DateTime updated_at 
    }
  

  "user_signature" {
    String id "🗝️"
    String signature_file_id 
    String signature_name 
    String signature_title "❓"
    String signature_phone "❓"
    String signature_email "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "file_share_link" {
    String id "🗝️"
    String share_token 
    String password_hash "❓"
    DateTime expires_at "❓"
    Int max_downloads "❓"
    Int download_count 
    Int view_count 
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    DateTime last_accessed_at "❓"
    }
  

  "storage_config" {
    String id "🗝️"
    String storage_provider 
    String s3_endpoint "❓"
    String s3_region "❓"
    String s3_bucket "❓"
    String s3_access_key_id "❓"
    String s3_secret_key "❓"
    Boolean s3_use_ssl 
    Boolean s3_force_path_style 
    Boolean enable_webp_conversion 
    Int webp_quality 
    Boolean enable_thumbnails 
    Int thumbnail_width 
    Int thumbnail_height 
    Boolean strip_exif 
    Boolean enable_pdf_thumbnails 
    Int pdf_thumbnail_quality 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "feature_flag" {
    String id "🗝️"
    String flag_key 
    String name 
    String description "❓"
    Boolean is_enabled 
    DateTime updated_at 
    }
  

  "maintenance_mode" {
    String id "🗝️"
    Boolean is_enabled 
    String mode 
    DateTime start_time "❓"
    DateTime end_time "❓"
    String message "❓"
    String allowed_ips "❓"
    DateTime updated_at 
    }
  

  "admin_notification" {
    String id "🗝️"
    String type 
    String title 
    String message 
    String link "❓"
    Boolean is_read 
    DateTime created_at 
    DateTime expires_at "❓"
    }
  

  "impersonation_session" {
    String id "🗝️"
    String session_token 
    DateTime expires_at 
    DateTime created_at 
    }
  

  "system_setting" {
    String id "🗝️"
    String setting_key 
    String setting_value 
    String data_type 
    String description "❓"
    DateTime updated_at 
    }
  

  "export_job" {
    String id "🗝️"
    String export_type 
    String format 
    Json filters "❓"
    String status 
    String file_path "❓"
    Int row_count "❓"
    String error_message "❓"
    DateTime created_at 
    DateTime completed_at "❓"
    }
  

  "job" {
    String id "🗝️"
    String job_type 
    String status 
    String tenant_id "❓"
    Json payload "❓"
    Json result "❓"
    String error_message "❓"
    Int attempts 
    Int max_retries 
    DateTime created_at 
    DateTime started_at "❓"
    DateTime completed_at "❓"
    DateTime failed_at "❓"
    Int duration_ms "❓"
    }
  

  "job_log" {
    String id "🗝️"
    DateTime timestamp 
    String level 
    String message 
    Json metadata "❓"
    }
  

  "scheduled_job" {
    String id "🗝️"
    String job_type 
    String name 
    String description "❓"
    String schedule 
    String timezone 
    Boolean is_enabled 
    DateTime last_run_at "❓"
    DateTime next_run_at "❓"
    Int max_retries 
    Int timeout_seconds 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "email_queue" {
    String id "🗝️"
    String template_key "❓"
    String to_email 
    Json cc_emails "❓"
    Json bcc_emails "❓"
    String subject 
    String html_body 
    String text_body "❓"
    String status 
    String smtp_message_id "❓"
    String error_message "❓"
    DateTime sent_at "❓"
    DateTime created_at 
    }
  

  "lead" {
    String id "🗝️"
    String first_name 
    String last_name 
    String language_spoken 
    Boolean accept_sms 
    String preferred_communication 
    String status 
    String source 
    String external_source_id "❓"
    DateTime created_at 
    DateTime updated_at 
    String lost_reason "❓"
    DateTime lost_at "❓"
    }
  

  "lead_email" {
    String id "🗝️"
    String email 
    Boolean is_primary 
    DateTime created_at 
    }
  

  "lead_phone" {
    String id "🗝️"
    String phone 
    String phone_type 
    Boolean is_primary 
    DateTime created_at 
    }
  

  "lead_address" {
    String id "🗝️"
    String address_line1 
    String address_line2 "❓"
    String city 
    String state 
    String zip_code 
    String country 
    Decimal latitude 
    Decimal longitude 
    String google_place_id "❓"
    Boolean is_primary 
    String address_type 
    DateTime created_at 
    }
  

  "service_request" {
    String id "🗝️"
    String service_name 
    String service_type "❓"
    String time_demand 
    String description "❓"
    Json extra_data "❓"
    String status 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "lead_note" {
    String id "🗝️"
    String note_text 
    Boolean is_pinned 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "lead_activity" {
    String id "🗝️"
    String activity_type 
    String description 
    Json metadata "❓"
    DateTime created_at 
    }
  

  "webhook_api_key" {
    String id "🗝️"
    String key_name 
    String api_key 
    String api_secret 
    Boolean is_active 
    Json allowed_sources "❓"
    Int rate_limit 
    DateTime last_used_at "❓"
    DateTime created_at 
    }
  

  "communication_provider" {
    String id "🗝️"
    String provider_key 
    String provider_name 
    communication_provider_type provider_type 
    Json credentials_schema 
    Json config_schema "❓"
    Json default_config "❓"
    Boolean supports_webhooks 
    Json webhook_events "❓"
    String webhook_verification_method "❓"
    String documentation_url "❓"
    String logo_url "❓"
    Boolean is_active 
    Boolean is_system 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "platform_email_config" {
    String id "🗝️"
    Json credentials 
    Json provider_config "❓"
    String from_email 
    String from_name 
    String reply_to_email "❓"
    String webhook_secret "❓"
    Boolean is_active 
    Boolean is_verified 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_email_config" {
    String id "🗝️"
    Json credentials 
    Json provider_config "❓"
    String from_email 
    String from_name 
    String reply_to_email "❓"
    String webhook_secret "❓"
    Boolean is_active 
    Boolean is_verified 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "email_template" {
    String id "🗝️"
    String template_key 
    email_template_category category 
    email_template_type template_type 
    String subject 
    String html_body 
    String text_body "❓"
    Json variables 
    Json variable_schema "❓"
    String description "❓"
    Boolean is_system 
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "communication_event" {
    String id "🗝️"
    communication_channel channel 
    communication_direction direction 
    communication_status status 
    String to_email "❓"
    String to_phone "❓"
    Json cc_emails "❓"
    Json bcc_emails "❓"
    String from_email "❓"
    String from_name "❓"
    String subject "❓"
    String html_body "❓"
    String text_body "❓"
    String template_key "❓"
    Json template_variables "❓"
    Json attachments "❓"
    String provider_message_id "❓"
    Json provider_metadata "❓"
    String webhook_signature "❓"
    String error_message "❓"
    DateTime sent_at "❓"
    DateTime delivered_at "❓"
    DateTime opened_at "❓"
    DateTime clicked_at "❓"
    DateTime bounced_at "❓"
    String bounce_type "❓"
    String related_entity_type "❓"
    String related_entity_id "❓"
    DateTime created_at 
    }
  

  "webhook_event" {
    String id "🗝️"
    String event_type 
    String provider_message_id "❓"
    Json payload 
    String signature "❓"
    Boolean signature_verified 
    String ip_address "❓"
    Boolean processed 
    DateTime processed_at "❓"
    String error_message "❓"
    DateTime created_at 
    }
  

  "notification" {
    String id "🗝️"
    String type 
    String title 
    String message 
    String action_url "❓"
    String related_entity_type "❓"
    String related_entity_id "❓"
    Boolean is_read 
    DateTime read_at "❓"
    DateTime expires_at "❓"
    DateTime created_at 
    }
  

  "notification_rule" {
    String id "🗝️"
    String event_type 
    Boolean notify_in_app 
    Boolean notify_email 
    String email_template_key "❓"
    notification_recipient_type recipient_type 
    Json specific_user_ids "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "unit_measurement" {
    String id "🗝️"
    String name 
    String abbreviation 
    Boolean is_global 
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_template" {
    String id "🗝️"
    String name 
    String description "❓"
    String html_content 
    String thumbnail_url "❓"
    Boolean is_global 
    Boolean is_active 
    Boolean is_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "vendor" {
    String id "🗝️"
    String name 
    String email 
    String phone 
    String address_line1 
    String address_line2 "❓"
    String city 
    String state 
    String zip_code 
    Decimal latitude 
    Decimal longitude 
    String google_place_id "❓"
    Boolean is_active 
    Boolean is_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_tag" {
    String id "🗝️"
    String name 
    String color 
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_warranty_tier" {
    String id "🗝️"
    String tier_name 
    String description "❓"
    warranty_price_type price_type 
    Decimal price_value 
    Int duration_months 
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_jobsite_address" {
    String id "🗝️"
    String address_line1 
    String address_line2 "❓"
    String city 
    String state 
    String zip_code 
    Decimal latitude 
    Decimal longitude 
    String google_place_id "❓"
    DateTime created_at 
    }
  

  "quote" {
    String id "🗝️"
    String quote_number 
    String title 
    quote_status status 
    String po_number "❓"
    String private_notes "❓"
    Boolean use_default_settings 
    Decimal custom_profit_percent "❓"
    Decimal custom_overhead_percent "❓"
    Decimal custom_contingency_percent "❓"
    String custom_terms "❓"
    String custom_payment_instructions "❓"
    Int expiration_days "❓"
    DateTime expires_at "❓"
    Decimal active_version_number 
    Decimal subtotal 
    Decimal tax_amount 
    Decimal discount_amount 
    Decimal total 
    Boolean is_archived 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_version" {
    String id "🗝️"
    Decimal version_number 
    String snapshot_data 
    String change_summary "❓"
    DateTime created_at 
    }
  

  "quote_group" {
    String id "🗝️"
    String name 
    String description "❓"
    Int order_index 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_item" {
    String id "🗝️"
    String item_library_id "❓"
    String title 
    String description "❓"
    Decimal quantity 
    Int order_index 
    Decimal material_cost_per_unit 
    Decimal labor_cost_per_unit 
    Decimal equipment_cost_per_unit 
    Decimal subcontract_cost_per_unit 
    Decimal other_cost_per_unit 
    Decimal total_cost 
    Decimal custom_markup_percent "❓"
    Decimal custom_discount_amount "❓"
    Decimal custom_tax_rate "❓"
    String private_notes "❓"
    Boolean save_to_library 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_approval" {
    String id "🗝️"
    Int approval_level 
    approval_status status 
    String comments "❓"
    DateTime decided_at "❓"
    DateTime created_at 
    }
  

  "quote_discount_rule" {
    String id "🗝️"
    discount_rule_type rule_type 
    Decimal value 
    String reason 
    discount_apply_to apply_to 
    Int order_index 
    DateTime created_at 
    }
  

  "quote_tag_assignment" {
    String id "🗝️"
    DateTime created_at 
    }
  

  "quote_attachment" {
    String id "🗝️"
    attachment_type attachment_type 
    String url "❓"
    String title "❓"
    grid_layout grid_layout "❓"
    Int order_index 
    DateTime created_at 
    }
  

  "quote_view_log" {
    String id "🗝️"
    String public_token 
    DateTime viewed_at 
    String ip_address "❓"
    Int view_duration_seconds "❓"
    device_type device_type "❓"
    String referrer_url "❓"
    }
  

  "draw_schedule_entry" {
    String id "🗝️"
    Int draw_number 
    String description 
    draw_calculation_type calculation_type 
    Decimal value 
    Int order_index 
    DateTime created_at 
    }
  

  "quote_public_access" {
    String id "🗝️"
    String access_token 
    String password_hash "❓"
    String password_hint "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime expires_at "❓"
    }
  

  "item_library" {
    String id "🗝️"
    String title 
    String description "❓"
    Decimal default_quantity 
    Decimal material_cost_per_unit 
    Decimal labor_cost_per_unit 
    Decimal equipment_cost_per_unit 
    Decimal subcontract_cost_per_unit 
    Decimal other_cost_per_unit 
    Int usage_count 
    DateTime last_used_at "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_bundle" {
    String id "🗝️"
    String name 
    String description "❓"
    discount_rule_type discount_type "❓"
    Decimal discount_value "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_bundle_item" {
    String id "🗝️"
    String item_library_id "❓"
    String title 
    String description "❓"
    Decimal quantity 
    Decimal material_cost_per_unit 
    Decimal labor_cost_per_unit 
    Decimal equipment_cost_per_unit 
    Decimal subcontract_cost_per_unit 
    Decimal other_cost_per_unit 
    Int order_index 
    DateTime created_at 
    }
  
    "audit_log" |o--|| "audit_log_actor_type" : "enum:actor_type"
    "audit_log" |o--|| "audit_log_status" : "enum:status"
    "audit_log" }o--|o "user" : "user"
    "audit_log" }o--|o "tenant" : "tenant"
    "file" }o--|| "tenant" : "tenant_file_tenant_idTotenant"
    "file" }o--|| "user" : "user"
    "tenant_industry" }o--|| "tenant" : "tenant"
    "tenant_industry" }o--|| industry : "industry"
    "permission" }o--|| "module" : "module"
    "refresh_token" }o--|| "user" : "user"
    "role_permission" }o--|| "permission" : "permission"
    "role_permission" }o--|| "role" : "role"
    "role_template_permission" }o--|| "permission" : "permission"
    "role_template_permission" }o--|| "role_template" : "role_template"
    "tenant" }o--|o "file" : "file_tenant_logo_file_idTofile"
    "tenant" }o--|o "subscription_plan" : "subscription_plan"
    "tenant" }o--|o "file" : "file_tenant_venmo_qr_code_file_idTofile"
    "tenant" }o--|o quote_template : "active_quote_template"
    "tenant_address" }o--|| "tenant" : "tenant"
    "tenant_business_hours" |o--|| "tenant" : "tenant"
    "tenant_custom_hours" }o--|| "tenant" : "tenant"
    "tenant_insurance" }o--|o "file" : "file_tenant_insurance_gl_document_file_idTofile"
    "tenant_insurance" |o--|| "tenant" : "tenant"
    "tenant_insurance" }o--|o "file" : "file_tenant_insurance_wc_document_file_idTofile"
    "tenant_license" }o--|o "file" : "file"
    "tenant_license" }o--|o "license_type" : "license_type"
    "tenant_license" }o--|| "tenant" : "tenant"
    "tenant_payment_terms" |o--|| "tenant" : "tenant"
    "tenant_service" }o--|| "service" : "service"
    "tenant_service" }o--|| "tenant" : "tenant"
    "tenant_service_area" }o--|| "tenant" : "tenant"
    "user" }o--|o "tenant" : "tenant"
    "user_role" }o--|o "user" : "user_user_role_assigned_by_user_idTouser"
    "user_role" }o--|| "role" : "role"
    "user_role" }o--|| "tenant" : "tenant"
    "user_role" }o--|| "user" : "user_user_role_user_idTouser"
    "user_signature" |o--|| "user" : "user"
    "file_share_link" }o--|| "file" : "file"
    "file_share_link" }o--|| "user" : "creator"
    "file_share_link" }o--|| "tenant" : "tenant"
    "storage_config" |o--|| "tenant" : "tenant"
    "feature_flag" }o--|o "user" : "updated_by_user"
    "maintenance_mode" }o--|o "user" : "updated_by_user"
    "impersonation_session" }o--|| "user" : "admin_user"
    "impersonation_session" }o--|| "user" : "impersonated_user"
    "impersonation_session" }o--|| "tenant" : "impersonated_tenant"
    "system_setting" }o--|o "user" : "updated_by_user"
    "export_job" }o--|| "user" : "admin_user"
    "job_log" }o--|| "job" : "job"
    "email_queue" |o--|| "job" : "job"
    "lead" }o--|| "tenant" : "tenant"
    "lead" }o--|o "user" : "created_by_user"
    "lead_email" }o--|| lead : "lead"
    "lead_phone" }o--|| lead : "lead"
    "lead_address" }o--|| lead : "lead"
    "service_request" }o--|| "tenant" : "tenant"
    "service_request" }o--|| lead : "lead"
    "service_request" }o--|o lead_address : "lead_address"
    "lead_note" }o--|| lead : "lead"
    "lead_note" }o--|o "user" : "user"
    "lead_activity" }o--|| lead : "lead"
    "lead_activity" }o--|o "user" : "user"
    "webhook_api_key" }o--|| "tenant" : "tenant"
    "webhook_api_key" }o--|| "user" : "created_by_user"
    "communication_provider" |o--|| "communication_provider_type" : "enum:provider_type"
    "platform_email_config" }o--|| communication_provider : "provider"
    "tenant_email_config" }o--|| "tenant" : "tenant"
    "tenant_email_config" }o--|| communication_provider : "provider"
    "email_template" |o--|| "email_template_category" : "enum:category"
    "email_template" |o--|| "email_template_type" : "enum:template_type"
    "email_template" }o--|o "tenant" : "tenant"
    "communication_event" |o--|| "communication_channel" : "enum:channel"
    "communication_event" |o--|| "communication_direction" : "enum:direction"
    "communication_event" |o--|| "communication_status" : "enum:status"
    "communication_event" }o--|o "tenant" : "tenant"
    "communication_event" }o--|| communication_provider : "provider"
    "communication_event" }o--|o "user" : "created_by_user"
    "webhook_event" }o--|| communication_provider : "provider"
    "webhook_event" }o--|o communication_event : "communication_event"
    "notification" }o--|| "tenant" : "tenant"
    "notification" }o--|o "user" : "user"
    "notification_rule" |o--|| "notification_recipient_type" : "enum:recipient_type"
    "notification_rule" }o--|| "tenant" : "tenant"
    "unit_measurement" }o--|o "tenant" : "tenant"
    "quote_template" }o--|o "tenant" : "tenant"
    "quote_template" }o--|o "user" : "created_by_user"
    "vendor" }o--|| "tenant" : "tenant"
    "vendor" }o--|| "file" : "signature_file"
    "vendor" }o--|o "user" : "created_by_user"
    "quote_tag" }o--|| "tenant" : "tenant"
    "quote_warranty_tier" |o--|| "warranty_price_type" : "enum:price_type"
    "quote_warranty_tier" }o--|| "tenant" : "tenant"
    "quote_jobsite_address" }o--|| "tenant" : "tenant"
    "quote" |o--|| "quote_status" : "enum:status"
    "quote" }o--|| "tenant" : "tenant"
    "quote" }o--|o lead : "lead"
    "quote" }o--|o vendor : "vendor"
    "quote" }o--|| quote_jobsite_address : "jobsite_address"
    "quote" }o--|o quote_template : "active_template"
    "quote" }o--|o "user" : "created_by_user"
    "quote_version" }o--|| quote : "quote"
    "quote_version" }o--|o "user" : "changed_by_user"
    "quote_group" }o--|| quote : "quote"
    "quote_item" }o--|| quote : "quote"
    "quote_item" }o--|o quote_group : "quote_group"
    "quote_item" }o--|| unit_measurement : "unit_measurement"
    "quote_item" }o--|o quote_warranty_tier : "warranty_tier"
    "quote_approval" |o--|| "approval_status" : "enum:status"
    "quote_approval" }o--|| quote : "quote"
    "quote_approval" }o--|| "user" : "approver_user"
    "quote_discount_rule" |o--|| "discount_rule_type" : "enum:rule_type"
    "quote_discount_rule" |o--|| "discount_apply_to" : "enum:apply_to"
    "quote_discount_rule" }o--|| quote : "quote"
    "quote_tag_assignment" }o--|| quote : "quote"
    "quote_tag_assignment" }o--|| quote_tag : "quote_tag"
    "quote_attachment" |o--|| "attachment_type" : "enum:attachment_type"
    "quote_attachment" |o--|o "grid_layout" : "enum:grid_layout"
    "quote_attachment" }o--|| quote : "quote"
    "quote_attachment" }o--|o "file" : "file"
    "quote_attachment" }o--|o "file" : "qr_code_file"
    "quote_view_log" |o--|o "device_type" : "enum:device_type"
    "quote_view_log" }o--|| quote : "quote"
    "draw_schedule_entry" |o--|| "draw_calculation_type" : "enum:calculation_type"
    "draw_schedule_entry" }o--|| quote : "quote"
    "quote_public_access" }o--|| quote : "quote"
    "item_library" }o--|| "tenant" : "tenant"
    "item_library" }o--|| unit_measurement : "unit_measurement"
    "item_library" }o--|o "user" : "created_by_user"
    "quote_bundle" |o--|o "discount_rule_type" : "enum:discount_type"
    "quote_bundle" }o--|| "tenant" : "tenant"
    "quote_bundle" }o--|o "user" : "created_by_user"
    "quote_bundle_item" }o--|| quote_bundle : "quote_bundle"
    "quote_bundle_item" }o--|| unit_measurement : "unit_measurement"
```
