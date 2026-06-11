export interface ScrapedLeadData {
  businessName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  website?: string;
  competitorRating?: number;
}

export type ActionType =
  | 'wait'          // Wait duration (e.g. minutes, hours, days)
  | 'email'         // Send email using a template
  | 'sms'           // Send SMS using a template
  | 'whatsapp'      // Send WhatsApp message using a template
  | 'ai_outreach'   // Generate AI copy and save it as a draft/log
  | 'stage_change'  // Move lead to a different pipeline stage/status
  | 'tag_change';   // Add/remove a tag

export interface WorkflowAction {
  id: string;
  type: ActionType;
  label: string;
  // action configurations
  delayValue?: number;     // e.g. 5
  delayUnit?: 'm' | 'h' | 'd'; // minutes, hours, days
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
  whatsappBody?: string;
  aiPrompt?: string;       // Custom prompt instructions for AI
  stage?: string;          // Target stage/status
  tag?: string;            // Tag to add or remove
  tagAction?: 'add' | 'remove';
}

export interface AutomationWorkflowData {
  id?: string;
  name: string;
  triggerType: 'LEAD_SCRAPED' | 'MANUAL';
  isActive: boolean;
  steps: WorkflowAction[];
}

export interface AutomationLogEntry {
  timestamp: string;
  message: string;
  details?: any;
}
