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
scheduled scheduled
sent sent
delivered delivered
failed failed
bounced bounced
opened opened
clicked clicked
cancelled cancelled
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
delivered delivered
read read
opened opened
downloaded downloaded
approved approved
started started
concluded concluded
denied denied
lost lost
email_failed email_failed
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
    


        payment_method {
            cash cash
check check
bank_transfer bank_transfer
venmo venmo
zelle zelle
        }
    


        subcontractor_compliance_status {
            valid valid
expiring_soon expiring_soon
expired expired
unknown unknown
        }
    


        subcontractor_document_type {
            insurance insurance
agreement agreement
coi coi
contract contract
license license
other other
        }
    


        project_task_category {
            labor labor
material material
subcontractor subcontractor
equipment equipment
other other
        }
    


        financial_category_type {
            labor labor
material material
subcontractor subcontractor
equipment equipment
other other
        }
    


        financial_entry_type {
            expense expense
income income
        }
    


        receipt_file_type {
            photo photo
pdf pdf
        }
    


        receipt_ocr_status {
            not_processed not_processed
processing processing
complete complete
failed failed
        }
    


        project_status {
            planned planned
in_progress in_progress
on_hold on_hold
completed completed
canceled canceled
        }
    


        project_task_status {
            not_started not_started
in_progress in_progress
blocked blocked
done done
        }
    


        task_assignee_type {
            crew_member crew_member
subcontractor subcontractor
user user
        }
    


        task_dependency_type {
            finish_to_start finish_to_start
start_to_start start_to_start
finish_to_finish finish_to_finish
        }
    


        project_document_type {
            contract contract
permit permit
blueprint blueprint
agreement agreement
photo photo
other other
        }
    


        log_attachment_file_type {
            photo photo
pdf pdf
document document
        }
    


        calendar_sync_status {
            pending pending
synced synced
failed failed
local_only local_only
        }
    


        permit_status {
            not_required not_required
pending_application pending_application
submitted submitted
approved approved
active active
failed failed
closed closed
        }
    


        MembershipStatus {
            INVITED INVITED
ACTIVE ACTIVE
INACTIVE INACTIVE
        }
    


        inspection_result {
            pass pass
fail fail
conditional conditional
pending pending
        }
    


        punch_list_status {
            open open
in_progress in_progress
resolved resolved
        }
    


        hour_log_source {
            manual manual
clockin_system clockin_system
        }
    


        invoice_status {
            pending pending
approved approved
paid paid
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
    Boolean voice_ai_enabled 
    Int voice_ai_minutes_included 
    Decimal voice_ai_overage_rate "❓"
    Int voice_ai_max_agent_profiles 
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
    Int next_project_number 
    Int default_quote_validity_days 
    String default_quote_terms "❓"
    String default_quote_footer "❓"
    String default_invoice_footer "❓"
    String default_payment_instructions "❓"
    String timezone 
    String default_language "❓"
    String business_description "❓"
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
    Boolean show_line_items_by_default 
    Boolean show_cost_breakdown_by_default 
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
  

  "user_tenant_membership" {
    String id "🗝️"
    MembershipStatus status 
    String invite_token_hash "❓"
    DateTime invite_token_expires_at "❓"
    DateTime invite_accepted_at "❓"
    DateTime joined_at "❓"
    DateTime left_at "❓"
    DateTime created_at 
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
  

  "scheduled_report" {
    String id "🗝️"
    String name 
    String report_type 
    String schedule 
    Json parameters 
    String format 
    Json recipients 
    Boolean is_active 
    DateTime next_run_at 
    DateTime last_run_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_sms_config" {
    String id "🗝️"
    String credentials 
    String from_phone 
    Boolean is_active 
    Boolean is_verified 
    String webhook_secret "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "tenant_whatsapp_config" {
    String id "🗝️"
    String credentials 
    String from_phone 
    Boolean is_active 
    Boolean is_verified 
    String webhook_secret "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "call_record" {
    String id "🗝️"
    String twilio_config_id "❓"
    String twilio_call_sid 
    String direction 
    String from_number 
    String to_number 
    String status 
    String call_type 
    String handled_by 
    String call_reason "❓"
    String outcome "❓"
    Int duration_seconds "❓"
    String recording_url "❓"
    Int recording_duration_seconds "❓"
    String recording_status 
    Json ivr_action_taken "❓"
    Boolean consent_message_played 
    Decimal cost "❓"
    DateTime started_at "❓"
    DateTime ended_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "ivr_configuration" {
    String id "🗝️"
    String twilio_config_id "❓"
    Boolean ivr_enabled 
    String greeting_message 
    Json menu_options 
    Json default_action 
    Int timeout_seconds 
    Int max_retries 
    Int max_depth 
    String status 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "office_number_whitelist" {
    String id "🗝️"
    String phone_number 
    String label 
    String status 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "call_transcription" {
    String id "🗝️"
    String transcription_provider 
    String status 
    String transcription_text "❓"
    Int channel_count "❓"
    String speaker_1_transcription "❓"
    String speaker_2_transcription "❓"
    String speaker_1_label "❓"
    String speaker_2_label "❓"
    String language_requested "❓"
    String language_detected "❓"
    Decimal confidence_score "❓"
    Int processing_duration_seconds "❓"
    Decimal cost "❓"
    String error_message "❓"
    Boolean is_current 
    Int retry_count 
    String previous_transcription_id "❓"
    DateTime created_at 
    DateTime completed_at "❓"
    }
  

  "transcription_provider_configuration" {
    String id "🗝️"
    String provider_name 
    Boolean is_system_default 
    String status 
    String configuration_json 
    Int usage_limit "❓"
    Int usage_current 
    Decimal cost_per_minute "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "voice_ai_provider" {
    String id "🗝️"
    String provider_key 
    String provider_type 
    String display_name 
    String description "❓"
    String logo_url "❓"
    String documentation_url "❓"
    String capabilities "❓"
    String config_schema "❓"
    String default_config "❓"
    String pricing_info "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "voice_ai_credentials" {
    String id "🗝️"
    String encrypted_api_key 
    String masked_api_key 
    String additional_config "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "voice_ai_global_config" {
    String id "🗝️"
    Boolean agent_enabled 
    String default_stt_config "❓"
    String default_llm_config "❓"
    String default_tts_config "❓"
    String default_voice_id "❓"
    String default_language 
    String default_languages 
    String default_greeting_template 
    String default_system_prompt 
    Int default_max_call_duration_seconds 
    Int default_max_call_seconds 
    String default_transfer_behavior 
    String default_tools_enabled 
    String livekit_url "❓"
    String livekit_sip_trunk_url "❓"
    String livekit_api_key_encrypted "❓"
    String livekit_api_secret_encrypted "❓"
    String livekit_api_key "❓"
    String livekit_api_secret "❓"
    String agent_api_key_hash "❓"
    String agent_api_key_preview "❓"
    Int max_concurrent_calls 
    Json recovery_messages "❓"
    Json filler_phrases "❓"
    Json long_wait_messages "❓"
    Json system_error_messages "❓"
    String tool_instructions "❓"
    DateTime created_at 
    DateTime updated_at 
    String updated_by "❓"
    }
  

  "tenant_voice_ai_settings" {
    String id "🗝️"
    Boolean is_enabled 
    String default_language 
    String enabled_languages 
    String custom_greeting "❓"
    String custom_instructions "❓"
    String after_hours_behavior "❓"
    Boolean booking_enabled 
    Boolean lead_creation_enabled 
    Boolean transfer_enabled 
    String default_transfer_number "❓"
    Int max_call_duration_seconds "❓"
    Int monthly_minutes_override "❓"
    String admin_notes "❓"
    String stt_provider_override_id "❓"
    String llm_provider_override_id "❓"
    String tts_provider_override_id "❓"
    String stt_config_override "❓"
    String llm_config_override "❓"
    String tts_config_override "❓"
    String voice_id_override "❓"
    String tool_instructions "❓"
    DateTime created_at 
    DateTime updated_at 
    String updated_by "❓"
    }
  

  "tenant_voice_transfer_number" {
    String id "🗝️"
    String label 
    String phone_number 
    String transfer_type 
    String description "❓"
    Boolean is_default 
    Boolean is_active 
    Int display_order 
    String available_hours "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "voice_ai_agent_profile" {
    String id "🗝️"
    String language_code 
    String language_name 
    String voice_id 
    String voice_provider_type 
    String default_greeting "❓"
    String default_instructions "❓"
    String display_name 
    String description "❓"
    Boolean is_active 
    Int display_order 
    DateTime created_at 
    DateTime updated_at 
    String updated_by "❓"
    }
  

  "tenant_voice_agent_profile_override" {
    String id "🗝️"
    String custom_greeting "❓"
    String custom_instructions "❓"
    Boolean is_active 
    Int display_order 
    DateTime created_at 
    DateTime updated_at 
    String updated_by "❓"
    }
  

  "voice_call_log" {
    String id "🗝️"
    String call_sid 
    String parent_call_sid "❓"
    String room_name "❓"
    String from_number 
    String to_number 
    String direction 
    String language_used "❓"
    String intent "❓"
    String status 
    String outcome "❓"
    Boolean is_overage 
    Int duration_seconds "❓"
    String transcript_summary "❓"
    String full_transcript "❓"
    String actions_taken "❓"
    String transferred_to "❓"
    String stt_provider_id "❓"
    String llm_provider_id "❓"
    String tts_provider_id "❓"
    String error_message "❓"
    String recording_url "❓"
    Int recording_duration_seconds "❓"
    String recording_status 
    String transcription_status 
    DateTime started_at 
    DateTime ended_at "❓"
    DateTime created_at 
    }
  

  "voice_usage_record" {
    String id "🗝️"
    String provider_type 
    Decimal usage_quantity 
    String usage_unit 
    Decimal estimated_cost "❓"
    Int year 
    Int month 
    DateTime billed_at 
    DateTime created_at 
    }
  

  "voice_monthly_usage" {
    String id "🗝️"
    Int year 
    Int month 
    Int minutes_used 
    Int overage_minutes 
    Decimal estimated_overage_cost "❓"
    Int total_calls 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "crew_member" {
    String id "🗝️"
    String first_name 
    String last_name 
    String email "❓"
    String phone "❓"
    String address_line1 "❓"
    String address_line2 "❓"
    String address_city "❓"
    String address_state "❓"
    String address_zip "❓"
    DateTime date_of_birth "❓"
    String ssn_encrypted "❓"
    String itin_encrypted "❓"
    Boolean has_drivers_license "❓"
    String drivers_license_number_encrypted "❓"
    Decimal default_hourly_rate "❓"
    Int weekly_hours_schedule "❓"
    Boolean overtime_enabled 
    Decimal overtime_rate_multiplier "❓"
    payment_method default_payment_method "❓"
    String bank_name "❓"
    String bank_routing_encrypted "❓"
    String bank_account_encrypted "❓"
    String venmo_handle "❓"
    String zelle_contact "❓"
    String notes "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
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
    Boolean sms_opt_out 
    DateTime sms_opt_out_at "❓"
    DateTime sms_opt_in_at "❓"
    String sms_opt_out_reason "❓"
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
  

  "appointment_type" {
    String id "🗝️"
    String name 
    String description "❓"
    Int slot_duration_minutes 
    Int max_lookahead_weeks 
    Boolean reminder_24h_enabled 
    Boolean reminder_1h_enabled 
    Boolean is_active 
    Boolean is_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "appointment_type_schedule" {
    String id "🗝️"
    Int day_of_week 
    Boolean is_available 
    String window1_start "❓"
    String window1_end "❓"
    String window2_start "❓"
    String window2_end "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "appointment" {
    String id "🗝️"
    String scheduled_date 
    String start_time 
    String end_time 
    DateTime start_datetime_utc 
    DateTime end_datetime_utc 
    String status 
    String cancellation_reason "❓"
    String cancellation_notes "❓"
    String notes "❓"
    String source 
    String external_calendar_event_id "❓"
    DateTime acknowledged_at "❓"
    DateTime created_at 
    DateTime updated_at 
    DateTime cancelled_at "❓"
    DateTime completed_at "❓"
    }
  

  "calendar_provider_connection" {
    String id "🗝️"
    String provider_type 
    String access_token 
    String refresh_token 
    DateTime token_expires_at 
    String connected_calendar_id 
    String connected_calendar_name "❓"
    String webhook_channel_id "❓"
    String webhook_resource_id "❓"
    String webhook_channel_token "❓"
    DateTime webhook_expiration "❓"
    String sync_status 
    DateTime last_sync_at "❓"
    String last_sync_token "❓"
    String error_message "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "calendar_sync_log" {
    String id "🗝️"
    String direction 
    String action 
    String external_event_id "❓"
    String status 
    String error_message "❓"
    Json metadata "❓"
    DateTime created_at 
    }
  

  "calendar_external_block" {
    String id "🗝️"
    String external_event_id 
    DateTime start_datetime_utc 
    DateTime end_datetime_utc 
    Boolean is_all_day 
    String source 
    DateTime created_at 
    DateTime updated_at 
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
    DateTime scheduled_at "❓"
    String scheduled_by "❓"
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
    Int retry_count 
    DateTime next_retry_at "❓"
    DateTime created_at 
    }
  

  "webhook_config" {
    String id "🗝️"
    String base_url 
    String webhook_secret 
    Boolean signature_verification 
    DateTime last_rotated "❓"
    DateTime created_at 
    DateTime updated_at 
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
  

  "twilio_usage_record" {
    String id "🗝️"
    String category 
    Int count 
    String usage_unit 
    Decimal price 
    String price_unit 
    DateTime start_date 
    DateTime end_date 
    DateTime synced_at 
    DateTime created_at 
    }
  

  "system_health_check" {
    String id "🗝️"
    String check_type 
    String status 
    Int response_time_ms "❓"
    String error_message "❓"
    Json details "❓"
    DateTime checked_at 
    }
  

  "admin_alert" {
    String id "🗝️"
    String type 
    String severity 
    String message 
    Json details "❓"
    Boolean acknowledged 
    DateTime acknowledged_at "❓"
    String comment "❓"
    Boolean resolved 
    DateTime resolved_at "❓"
    String resolution "❓"
    DateTime created_at 
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
    String template_type 
    Json visual_structure "❓"
    String html_content "❓"
    String css_content "❓"
    Json tags "❓"
    String thumbnail_url "❓"
    Boolean is_prebuilt 
    Boolean is_global 
    Boolean is_active 
    Boolean is_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_template_version" {
    String id "🗝️"
    Int version_number 
    String template_type 
    Json visual_structure "❓"
    String html_content "❓"
    String css_content "❓"
    String changes_summary "❓"
    Int render_time_ms "❓"
    Int pdf_size_kb "❓"
    DateTime created_at 
    }
  

  "template_category" {
    String id "🗝️"
    String name 
    String description "❓"
    String icon_name "❓"
    Int sort_order 
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "template_component" {
    String id "🗝️"
    String name 
    String description "❓"
    String component_type 
    Json structure 
    Json default_props "❓"
    String html_template 
    String css_template "❓"
    String thumbnail_url "❓"
    String preview_html "❓"
    String usage_notes "❓"
    String category 
    Json tags "❓"
    Boolean is_global 
    Boolean is_active 
    Int sort_order 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "template_usage_log" {
    String id "🗝️"
    String event_type 
    Int render_time_ms "❓"
    Int pdf_generation_time_ms "❓"
    Int pdf_size_kb "❓"
    DateTime created_at 
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
    Decimal custom_tax_rate "❓"
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
    String pdf_content_hash "❓"
    DateTime pdf_last_generated_at "❓"
    Json pdf_generation_params "❓"
    Boolean deletion_locked 
    }
  

  "quote_note" {
    String id "🗝️"
    String note_text 
    Boolean is_pinned 
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
    Decimal custom_profit_percent "❓"
    Decimal custom_overhead_percent "❓"
    Decimal custom_contingency_percent "❓"
    Decimal custom_discount_percentage "❓"
    Decimal custom_discount_amount "❓"
    String private_notes "❓"
    Boolean save_to_library 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "quote_approval" {
    String id "🗝️"
    String workflow_id 
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
  

  "quote_download_log" {
    String id "🗝️"
    String public_token 
    DateTime downloaded_at 
    String ip_address "❓"
    device_type device_type "❓"
    String file_id "❓"
    String download_type 
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
  

  "sms_template" {
    String id "🗝️"
    String name 
    String description "❓"
    String template_body 
    String category "❓"
    Boolean is_active 
    Boolean is_default 
    Int usage_count 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "subcontractor" {
    String id "🗝️"
    String business_name 
    String trade_specialty "❓"
    String email "❓"
    String website "❓"
    String insurance_provider "❓"
    String insurance_policy_number "❓"
    DateTime insurance_expiry_date "❓"
    Boolean coi_on_file 
    subcontractor_compliance_status compliance_status 
    payment_method default_payment_method "❓"
    String bank_name "❓"
    String bank_routing_encrypted "❓"
    String bank_account_encrypted "❓"
    String venmo_handle "❓"
    String zelle_contact "❓"
    String notes "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "subcontractor_contact" {
    String id "🗝️"
    String contact_name 
    String phone 
    String role "❓"
    String email "❓"
    Boolean is_primary 
    DateTime created_at 
    }
  

  "subcontractor_document" {
    String id "🗝️"
    String file_url 
    String file_name 
    subcontractor_document_type document_type 
    String description "❓"
    DateTime created_at 
    }
  

  "project_template" {
    String id "🗝️"
    String name 
    String description "❓"
    String industry_type "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project_template_task" {
    String id "🗝️"
    String title 
    String description "❓"
    Int estimated_duration_days "❓"
    project_task_category category "❓"
    Int order_index 
    Int depends_on_order_index "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "financial_category" {
    String id "🗝️"
    String name 
    financial_category_type type 
    String description "❓"
    Boolean is_active 
    Boolean is_system_default 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "financial_entry" {
    String id "🗝️"
    String task_id "❓"
    financial_entry_type entry_type 
    Decimal amount 
    DateTime entry_date 
    String vendor_name "❓"
    String notes "❓"
    Boolean has_receipt 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "receipt" {
    String id "🗝️"
    String file_url 
    String file_name 
    receipt_file_type file_type 
    Int file_size_bytes "❓"
    String vendor_name "❓"
    Decimal amount "❓"
    DateTime receipt_date "❓"
    String ocr_raw "❓"
    receipt_ocr_status ocr_status 
    String ocr_vendor "❓"
    Decimal ocr_amount "❓"
    DateTime ocr_date "❓"
    Boolean is_categorized 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project" {
    String id "🗝️"
    String project_number 
    String name 
    String description "❓"
    project_status status 
    DateTime start_date "❓"
    DateTime target_completion_date "❓"
    DateTime actual_completion_date "❓"
    Boolean permit_required 
    Decimal contract_value "❓"
    Decimal estimated_cost "❓"
    Decimal progress_percent 
    Boolean is_standalone 
    Boolean portal_enabled 
    Boolean deletion_locked 
    String notes "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project_task" {
    String id "🗝️"
    String title 
    String description "❓"
    project_task_status status 
    Int estimated_duration_days "❓"
    DateTime estimated_start_date "❓"
    DateTime estimated_end_date "❓"
    DateTime actual_start_date "❓"
    DateTime actual_end_date "❓"
    Boolean is_delayed 
    Int order_index 
    project_task_category category "❓"
    String notes "❓"
    DateTime deleted_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "task_dependency" {
    String id "🗝️"
    task_dependency_type dependency_type 
    DateTime created_at 
    }
  

  "task_assignee" {
    String id "🗝️"
    task_assignee_type assignee_type 
    DateTime assigned_at 
    }
  

  "project_activity" {
    String id "🗝️"
    String activity_type 
    String description 
    Json metadata "❓"
    DateTime created_at 
    }
  

  "project_document" {
    String id "🗝️"
    String file_url 
    String file_name 
    project_document_type document_type 
    String description "❓"
    Boolean is_public 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project_photo" {
    String id "🗝️"
    String file_url 
    String thumbnail_url "❓"
    String caption "❓"
    Boolean is_public 
    DateTime taken_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project_log" {
    String id "🗝️"
    DateTime log_date 
    String content 
    Boolean is_public 
    Boolean weather_delay 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project_log_attachment" {
    String id "🗝️"
    String file_url 
    String file_name 
    log_attachment_file_type file_type 
    Int file_size_bytes "❓"
    DateTime created_at 
    }
  

  "task_calendar_event" {
    String id "🗝️"
    String title 
    String description "❓"
    DateTime start_datetime 
    DateTime end_datetime 
    String google_event_id "❓"
    String internal_calendar_id "❓"
    calendar_sync_status sync_status 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "permit" {
    String id "🗝️"
    String permit_number "❓"
    String permit_type 
    permit_status status 
    DateTime submitted_date "❓"
    DateTime approved_date "❓"
    DateTime expiry_date "❓"
    String issuing_authority "❓"
    String notes "❓"
    DateTime deleted_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "inspection" {
    String id "🗝️"
    String inspection_type 
    DateTime scheduled_date "❓"
    String inspector_name "❓"
    inspection_result result "❓"
    Boolean reinspection_required 
    DateTime reinspection_date "❓"
    String notes "❓"
    DateTime deleted_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "completion_checklist_template" {
    String id "🗝️"
    String name 
    String description "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "completion_checklist_template_item" {
    String id "🗝️"
    String title 
    String description "❓"
    Boolean is_required 
    Int order_index 
    DateTime created_at 
    DateTime updated_at 
    }
  

  "project_completion_checklist" {
    String id "🗝️"
    DateTime completed_at "❓"
    DateTime created_at 
    }
  

  "project_completion_checklist_item" {
    String id "🗝️"
    String title 
    Boolean is_required 
    Boolean is_completed 
    DateTime completed_at "❓"
    String notes "❓"
    Int order_index 
    DateTime updated_at 
    }
  

  "punch_list_item" {
    String id "🗝️"
    String title 
    String description "❓"
    punch_list_status status 
    DateTime resolved_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "crew_payment_record" {
    String id "🗝️"
    Decimal amount 
    DateTime payment_date 
    payment_method payment_method 
    String reference_number "❓"
    DateTime period_start_date "❓"
    DateTime period_end_date "❓"
    Decimal hours_paid "❓"
    String notes "❓"
    DateTime created_at 
    }
  

  "crew_hour_log" {
    String id "🗝️"
    DateTime log_date 
    Decimal hours_regular 
    Decimal hours_overtime 
    hour_log_source source 
    String clockin_event_id "❓"
    String notes "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "subcontractor_payment_record" {
    String id "🗝️"
    Decimal amount 
    DateTime payment_date 
    payment_method payment_method 
    String reference_number "❓"
    String notes "❓"
    DateTime created_at 
    }
  

  "subcontractor_task_invoice" {
    String id "🗝️"
    String invoice_number "❓"
    DateTime invoice_date "❓"
    Decimal amount 
    invoice_status status 
    String notes "❓"
    String file_url "❓"
    String file_name "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "portal_account" {
    String id "🗝️"
    String email 
    String customer_slug 
    String password_hash 
    Boolean must_change_password 
    DateTime last_login_at "❓"
    String reset_token "❓"
    DateTime reset_token_expires_at "❓"
    Boolean is_active 
    DateTime created_at 
    DateTime updated_at 
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
    "user_role" }o--|o "user" : "user_user_role_assigned_by_user_idTouser"
    "user_role" }o--|| "role" : "role"
    "user_role" }o--|| "tenant" : "tenant"
    "user_role" }o--|| "user" : "user_user_role_user_idTouser"
    "user_tenant_membership" |o--|| "MembershipStatus" : "enum:status"
    "user_tenant_membership" }o--|| "user" : "user"
    "user_tenant_membership" }o--|| "tenant" : "tenant"
    "user_tenant_membership" }o--|| "role" : "role"
    "user_tenant_membership" }o--|o "user" : "invited_by"
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
    "scheduled_report" }o--|| "user" : "admin_user"
    "tenant_sms_config" }o--|| "tenant" : "tenant"
    "tenant_sms_config" }o--|| communication_provider : "provider"
    "tenant_whatsapp_config" }o--|| "tenant" : "tenant"
    "tenant_whatsapp_config" }o--|| communication_provider : "provider"
    "call_record" }o--|o "tenant" : "tenant"
    "call_record" }o--|o lead : "lead"
    "call_record" }o--|o "user" : "initiated_by_user"
    "call_record" |o--|o voice_call_log : "voice_call_log"
    "ivr_configuration" |o--|| "tenant" : "tenant"
    "office_number_whitelist" }o--|| "tenant" : "tenant"
    "call_transcription" }o--|o "tenant" : "tenant"
    "call_transcription" }o--|| call_record : "call_record"
    "transcription_provider_configuration" }o--|o "tenant" : "tenant"
    "voice_ai_credentials" |o--|| voice_ai_provider : "provider"
    "voice_ai_credentials" }o--|o "user" : "updated_by_user"
    "voice_ai_global_config" }o--|o voice_ai_provider : "stt_provider"
    "voice_ai_global_config" }o--|o voice_ai_provider : "llm_provider"
    "voice_ai_global_config" }o--|o voice_ai_provider : "tts_provider"
    "tenant_voice_ai_settings" |o--|| "tenant" : "tenant"
    "tenant_voice_ai_settings" }o--|o tenant_voice_transfer_number : "default_transfer_number_rel"
    "tenant_voice_transfer_number" }o--|| "tenant" : "tenant"
    "tenant_voice_agent_profile_override" }o--|| "tenant" : "tenant"
    "tenant_voice_agent_profile_override" }o--|| voice_ai_agent_profile : "agent_profile"
    "voice_call_log" }o--|| "tenant" : "tenant"
    "voice_call_log" }o--|o lead : "lead"
    "voice_usage_record" }o--|| "tenant" : "tenant"
    "voice_usage_record" }o--|| voice_call_log : "call_log"
    "voice_usage_record" }o--|| voice_ai_provider : "provider"
    "voice_monthly_usage" }o--|| "tenant" : "tenant"
    "crew_member" |o--|o "payment_method" : "enum:default_payment_method"
    "crew_member" }o--|| "tenant" : "tenant"
    "crew_member" |o--|o "user" : "user"
    "crew_member" }o--|| "user" : "created_by"
    "crew_member" }o--|o "file" : "profile_photo"
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
    "appointment_type" }o--|| "tenant" : "tenant"
    "appointment_type" }o--|o "user" : "created_by"
    "appointment_type_schedule" }o--|| appointment_type : "appointment_type"
    "appointment" }o--|| "tenant" : "tenant"
    "appointment" }o--|| appointment_type : "appointment_type"
    "appointment" }o--|| lead : "lead"
    "appointment" }o--|o service_request : "service_request"
    "appointment" }o--|o "user" : "assigned_user"
    "appointment" }o--|o "user" : "created_by"
    "appointment" }o--|o "user" : "cancelled_by"
    "appointment" |o--|o appointment : "rescheduled_from"
    "calendar_provider_connection" }o--|| "tenant" : "tenant"
    "calendar_provider_connection" }o--|o "user" : "connected_by"
    "calendar_sync_log" }o--|| "tenant" : "tenant"
    "calendar_sync_log" }o--|| "calendar_provider_connection" : "connection"
    "calendar_sync_log" }o--|o appointment : "appointment"
    "calendar_external_block" }o--|| "tenant" : "tenant"
    "calendar_external_block" }o--|| "calendar_provider_connection" : "connection"
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
    "twilio_usage_record" }o--|o "tenant" : "tenant"
    "admin_alert" }o--|o "user" : "acknowledged_by_user"
    "admin_alert" }o--|o "user" : "resolved_by_user"
    "unit_measurement" }o--|o "tenant" : "tenant"
    "quote_template" }o--|o "tenant" : "tenant"
    "quote_template" }o--|o "user" : "created_by_user"
    "quote_template" }o--|o template_category : "category"
    "quote_template" |o--|o quote_template : "source_template"
    "quote_template_version" }o--|| quote_template : "template"
    "quote_template_version" }o--|o "user" : "created_by_user"
    "template_component" }o--|o "tenant" : "tenant"
    "template_component" }o--|o "user" : "created_by_user"
    "template_usage_log" }o--|| quote_template : "template"
    "template_usage_log" }o--|| "tenant" : "tenant"
    "template_usage_log" }o--|o quote : "quote"
    "vendor" }o--|| "tenant" : "tenant"
    "vendor" }o--|o "file" : "signature_file"
    "vendor" }o--|o "user" : "created_by_user"
    "quote_tag" }o--|| "tenant" : "tenant"
    "quote_warranty_tier" |o--|| "warranty_price_type" : "enum:price_type"
    "quote_warranty_tier" }o--|| "tenant" : "tenant"
    "quote_jobsite_address" }o--|| "tenant" : "tenant"
    "quote" |o--|| "quote_status" : "enum:status"
    "quote" }o--|| "tenant" : "tenant"
    "quote" |o--|o quote : "parent_quote"
    "quote" }o--|o lead : "lead"
    "quote" }o--|o vendor : "vendor"
    "quote" }o--|| quote_jobsite_address : "jobsite_address"
    "quote" }o--|o quote_template : "active_template"
    "quote" }o--|o "user" : "created_by_user"
    "quote" }o--|o "file" : "latest_pdf_file"
    "quote_note" }o--|| quote : "quote"
    "quote_note" }o--|o "user" : "user"
    "quote_version" }o--|| quote : "quote"
    "quote_version" }o--|o "user" : "changed_by_user"
    "quote_group" }o--|| quote : "quote"
    "quote_item" }o--|| quote : "quote"
    "quote_item" }o--|o quote_group : "quote_group"
    "quote_item" }o--|| unit_measurement : "unit_measurement"
    "quote_item" }o--|o quote_warranty_tier : "warranty_tier"
    "quote_item" }o--|o quote_bundle : "source_bundle"
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
    "quote_download_log" |o--|o "device_type" : "enum:device_type"
    "quote_download_log" }o--|| quote : "quote"
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
    "sms_template" }o--|| "tenant" : "tenant"
    "sms_template" }o--|| "user" : "creator"
    "subcontractor" |o--|| "subcontractor_compliance_status" : "enum:compliance_status"
    "subcontractor" |o--|o "payment_method" : "enum:default_payment_method"
    "subcontractor" }o--|| "tenant" : "tenant"
    "subcontractor" }o--|| "user" : "created_by"
    "subcontractor_contact" }o--|| "tenant" : "tenant"
    "subcontractor_contact" }o--|| subcontractor : "subcontractor"
    "subcontractor_document" |o--|| "subcontractor_document_type" : "enum:document_type"
    "subcontractor_document" }o--|| "tenant" : "tenant"
    "subcontractor_document" }o--|| subcontractor : "subcontractor"
    "subcontractor_document" }o--|| "file" : "file"
    "subcontractor_document" }o--|| "user" : "uploaded_by"
    "project_template" }o--|| "tenant" : "tenant"
    "project_template" }o--|| "user" : "created_by"
    "project_template_task" |o--|o "project_task_category" : "enum:category"
    "project_template_task" }o--|| project_template : "template"
    "project_template_task" }o--|| "tenant" : "tenant"
    "financial_category" |o--|| "financial_category_type" : "enum:type"
    "financial_category" }o--|| "tenant" : "tenant"
    "financial_category" }o--|o "user" : "created_by"
    "financial_entry" |o--|| "financial_entry_type" : "enum:entry_type"
    "financial_entry" }o--|| "tenant" : "tenant"
    "financial_entry" }o--|| financial_category : "category"
    "financial_entry" }o--|| "user" : "created_by"
    "financial_entry" }o--|o "user" : "updated_by"
    "financial_entry" }o--|o crew_member : "crew_member"
    "financial_entry" }o--|o subcontractor : "subcontractor"
    "financial_entry" }o--|| project : "project"
    "receipt" |o--|| "receipt_file_type" : "enum:file_type"
    "receipt" |o--|| "receipt_ocr_status" : "enum:ocr_status"
    "receipt" }o--|| "tenant" : "tenant"
    "receipt" }o--|o financial_entry : "financial_entry"
    "receipt" }o--|o project : "project"
    "receipt" }o--|o project_task : "task"
    "receipt" }o--|| "user" : "uploaded_by_user"
    "receipt" }o--|| "file" : "file"
    "project" |o--|| "project_status" : "enum:status"
    "project" }o--|| "tenant" : "tenant"
    "project" }o--|o quote : "quote"
    "project" }o--|o lead : "lead"
    "project" }o--|o "user" : "assigned_pm_user"
    "project" }o--|| "user" : "created_by_user"
    "project_task" |o--|| "project_task_status" : "enum:status"
    "project_task" |o--|o "project_task_category" : "enum:category"
    "project_task" }o--|| "tenant" : "tenant"
    "project_task" }o--|| project : "project"
    "project_task" }o--|o quote_item : "quote_item"
    "project_task" }o--|| "user" : "created_by"
    "task_dependency" |o--|| "task_dependency_type" : "enum:dependency_type"
    "task_dependency" }o--|| "tenant" : "tenant"
    "task_dependency" }o--|| project_task : "task"
    "task_dependency" }o--|| project_task : "depends_on_task"
    "task_dependency" }o--|| "user" : "created_by"
    "task_assignee" |o--|| "task_assignee_type" : "enum:assignee_type"
    "task_assignee" }o--|| "tenant" : "tenant"
    "task_assignee" }o--|| project_task : "task"
    "task_assignee" }o--|o crew_member : "crew_member"
    "task_assignee" }o--|o subcontractor : "subcontractor"
    "task_assignee" }o--|o "user" : "assignee_user"
    "task_assignee" }o--|| "user" : "assigned_by"
    "project_activity" }o--|| "tenant" : "tenant"
    "project_activity" }o--|| project : "project"
    "project_activity" }o--|o "user" : "user"
    "project_document" |o--|| "project_document_type" : "enum:document_type"
    "project_document" }o--|| "tenant" : "tenant"
    "project_document" }o--|| project : "project"
    "project_document" }o--|| "user" : "uploaded_by_user"
    "project_document" }o--|| "file" : "file"
    "project_photo" }o--|| "tenant" : "tenant"
    "project_photo" }o--|| project : "project"
    "project_photo" }o--|o project_task : "task"
    "project_photo" }o--|| "user" : "uploaded_by_user"
    "project_photo" }o--|| "file" : "file"
    "project_photo" }o--|o project_log : "log"
    "project_log" }o--|| "tenant" : "tenant"
    "project_log" }o--|| project : "project"
    "project_log" }o--|o project_task : "task"
    "project_log" }o--|| "user" : "author"
    "project_log_attachment" |o--|| "log_attachment_file_type" : "enum:file_type"
    "project_log_attachment" }o--|| project_log : "log"
    "project_log_attachment" }o--|| "file" : "file"
    "project_log_attachment" }o--|| "tenant" : "tenant"
    "task_calendar_event" |o--|| "calendar_sync_status" : "enum:sync_status"
    "task_calendar_event" }o--|| "tenant" : "tenant"
    "task_calendar_event" }o--|| project_task : "task"
    "task_calendar_event" }o--|| project : "project"
    "task_calendar_event" }o--|| "user" : "created_by"
    "permit" |o--|| "permit_status" : "enum:status"
    "permit" }o--|| "tenant" : "tenant"
    "permit" }o--|| project : "project"
    "permit" }o--|| "user" : "created_by"
    "inspection" |o--|o "inspection_result" : "enum:result"
    "inspection" }o--|| "tenant" : "tenant"
    "inspection" }o--|| permit : "permit"
    "inspection" }o--|| project : "project"
    "inspection" }o--|o "user" : "inspected_by"
    "completion_checklist_template" }o--|| "tenant" : "tenant"
    "completion_checklist_template" }o--|| "user" : "created_by"
    "completion_checklist_template_item" }o--|| completion_checklist_template : "template"
    "completion_checklist_template_item" }o--|| "tenant" : "tenant"
    "project_completion_checklist" }o--|| "tenant" : "tenant"
    "project_completion_checklist" }o--|| project : "project"
    "project_completion_checklist" }o--|o completion_checklist_template : "template"
    "project_completion_checklist" }o--|o "user" : "created_by"
    "project_completion_checklist_item" }o--|| project_completion_checklist : "checklist"
    "project_completion_checklist_item" }o--|o completion_checklist_template_item : "template_item"
    "project_completion_checklist_item" }o--|| "tenant" : "tenant"
    "project_completion_checklist_item" }o--|o "user" : "completed_by"
    "punch_list_item" |o--|| "punch_list_status" : "enum:status"
    "punch_list_item" }o--|| "tenant" : "tenant"
    "punch_list_item" }o--|| project_completion_checklist : "checklist"
    "punch_list_item" }o--|| project : "project"
    "punch_list_item" }o--|o "user" : "reported_by"
    "punch_list_item" }o--|o "user" : "resolved_by"
    "punch_list_item" }o--|o crew_member : "assigned_to_crew"
    "crew_payment_record" |o--|| "payment_method" : "enum:payment_method"
    "crew_payment_record" }o--|| "tenant" : "tenant"
    "crew_payment_record" }o--|| crew_member : "crew_member"
    "crew_payment_record" }o--|o project : "project"
    "crew_payment_record" }o--|| "user" : "created_by"
    "crew_hour_log" |o--|| "hour_log_source" : "enum:source"
    "crew_hour_log" }o--|| "tenant" : "tenant"
    "crew_hour_log" }o--|| crew_member : "crew_member"
    "crew_hour_log" }o--|| project : "project"
    "crew_hour_log" }o--|o project_task : "task"
    "crew_hour_log" }o--|| "user" : "created_by"
    "subcontractor_payment_record" |o--|| "payment_method" : "enum:payment_method"
    "subcontractor_payment_record" }o--|| "tenant" : "tenant"
    "subcontractor_payment_record" }o--|| subcontractor : "subcontractor"
    "subcontractor_payment_record" }o--|o project : "project"
    "subcontractor_payment_record" }o--|| "user" : "created_by"
    "subcontractor_task_invoice" |o--|| "invoice_status" : "enum:status"
    "subcontractor_task_invoice" }o--|| "tenant" : "tenant"
    "subcontractor_task_invoice" }o--|| subcontractor : "subcontractor"
    "subcontractor_task_invoice" }o--|| project_task : "task"
    "subcontractor_task_invoice" }o--|| project : "project"
    "subcontractor_task_invoice" }o--|o "file" : "file"
    "subcontractor_task_invoice" }o--|| "user" : "created_by"
    "portal_account" }o--|| "tenant" : "tenant"
    "portal_account" }o--|| lead : "lead"
```
