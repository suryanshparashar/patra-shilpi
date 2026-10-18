/** Hand-written mirror of the API's Pydantic models (agents.schemas / agents.result). */
import { z } from "zod";

export const SECTIONS = ["summary", "skills", "experience", "projects"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_INFO: Record<Section, { label: string; hint: string }> = {
  summary: { label: "Summary", hint: "Rewrite it to match the role" },
  skills: { label: "Skills", hint: "Highlight and reorder what matches" },
  experience: { label: "Experience", hint: "Reorder and rephrase bullets" },
  projects: { label: "Projects", hint: "Surface the most relevant work" },
};

export const JD_MIN_CHARS = 50;
export const JD_MAX_CHARS = 10_000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// --- Form input -------------------------------------------------------------------------

export const customizeInputSchema = z.object({
  jdText: z
    .string()
    .trim()
    .min(1, "Paste the job description.")
    .min(
      JD_MIN_CHARS,
      `The job description is too short. Enter at least ${JD_MIN_CHARS} characters.`,
    )
    .max(
      JD_MAX_CHARS,
      `The job description is too long. Keep it under ${JD_MAX_CHARS} characters.`,
    ),
  sections: z.array(z.enum(SECTIONS)).min(1, "Select at least one section to customize."),
  file: z
    .instanceof(File, { message: "Upload your resume as a PDF." })
    .refine((f) => f.size > 0, "The selected file is empty.")
    .refine((f) => f.size <= MAX_FILE_BYTES, "The file is too large. The maximum size is 5 MB.")
    .refine(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
      "Only PDF files are supported.",
    ),
});
export type CustomizeInput = z.infer<typeof customizeInputSchema>;
export type InputErrors = Partial<Record<keyof CustomizeInput, string>>;

export function validateInput(values: { jdText: string; sections: Section[]; file: File | null }): {
  data: CustomizeInput | null;
  errors: InputErrors;
} {
  const parsed = customizeInputSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data, errors: {} };
  const errors: InputErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof CustomizeInput;
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

// --- Resume -----------------------------------------------------------------------------

const text = z.string().nullable();

export const experienceItemSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: text,
  start_date: text,
  end_date: text,
  bullets: z.array(z.string()),
});

export const projectItemSchema = z.object({
  name: z.string(),
  description: text,
  technologies: z.array(z.string()),
  bullets: z.array(z.string()),
});

export const educationItemSchema = z.object({
  institution: z.string(),
  degree: text,
  field_of_study: text,
  start_date: text,
  end_date: text,
  details: z.array(z.string()),
});

export const structuredResumeSchema = z.object({
  contact: z.object({
    name: text,
    email: text,
    phone: text,
    location: text,
    links: z.array(z.string()),
  }),
  summary: text,
  skills: z.array(z.string()),
  experience: z.array(experienceItemSchema),
  projects: z.array(projectItemSchema),
  education: z.array(educationItemSchema),
  certifications: z.array(z.string()),
  additional: z.array(z.string()),
});
export type StructuredResume = z.infer<typeof structuredResumeSchema>;

export const jdAnalysisSchema = z.object({
  role_title: z.string(),
  company: text,
  seniority: text,
  domain: text,
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  keywords: z.array(z.string()),
  responsibilities: z.array(z.string()),
});
export type JDAnalysis = z.infer<typeof jdAnalysisSchema>;

// --- Run result -------------------------------------------------------------------------

const guardrailIssueSchema = z.object({
  section: z.string(),
  claim: z.string(),
  reason: z.string(),
});
export type GuardrailIssue = z.infer<typeof guardrailIssueSchema>;

/** A flagged line put back to the original by default. Locations refer to `rewritten_resume`. */
export const revertedLineSchema = z.object({
  section: z.enum(["summary", "skills", "experience", "projects"]),
  item: z.number().nullish(),
  bullet: z.number().nullish(),
  skill: z.string().nullish(),
  /** What it goes back to; null means the line is removed. */
  original: z.string().nullable(),
  rewrite: z.string(),
  reason: z.string(),
});
export type RevertedLine = z.infer<typeof revertedLineSchema>;

export const runResultSchema = z.object({
  status: z.enum(["completed", "partial", "failed"]),
  jd_analysis: jdAnalysisSchema.nullish(),
  original_resume: structuredResumeSchema.nullable(),
  customized_resume: structuredResumeSchema.nullable(),
  highlighted_skills: z.array(z.string()),
  match_before: z.number().nullable(),
  match_after: z.number().nullable(),
  ats_report: z
    .object({
      score: z.number(),
      strengths: z.array(z.string()),
      issues: z.array(z.string()),
      /** The fixed rubric the score is the sum of (empty for runs saved before it existed). */
      breakdown: z
        .array(z.object({ name: z.string(), score: z.number(), max: z.number() }))
        .optional(),
    })
    .nullable(),
  keyword_gap: z
    .object({
      missing_keywords: z.array(
        z.object({
          keyword: z.string(),
          importance: z.enum(["required", "preferred"]),
          suggestion: z.string(),
        }),
      ),
    })
    .nullable(),
  /** Flags that could not be located and reverted: left for the user to review. */
  guardrail_issues: z.array(guardrailIssueSchema),
  /** The draft before flagged lines were restored, and those restores. */
  rewritten_resume: structuredResumeSchema.nullish(),
  reverted: z.array(revertedLineSchema).optional(),
  cover_letter: z.string().nullable(),
  /** Claims in the cover letter the fact-check still flags after its rewrite. */
  letter_issues: z.array(guardrailIssueSchema).optional(),
  /** Position of the letter in the saved run's letters, for saving the user's edits to it. */
  letter_index: z.number().nullish(),
  errors: z.array(
    z.object({ worker: z.string(), message: z.string(), code: z.string().nullish() }),
  ),
  /** The saved history entry, for logged-in users. */
  run_id: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});
export type RunResult = z.infer<typeof runResultSchema>;

// --- Stream events ----------------------------------------------------------------------

export const progressEventSchema = z.object({
  worker: z.string(),
  status: z.enum(["started", "done", "failed", "decided"]),
  label: z.string(),
  message: z.string().nullish(),
  /** Which user-facing step this is (see the `plan` event). Absent for the supervisor. */
  step: z.string().nullish(),
  elapsed_ms: z.number().nullish(),
  /** A one-line result for a finished step, e.g. "4 roles, 2 projects, 18 skills". */
  summary: z.string().nullish(),
  /** The provider's error code and status on a failed step, e.g. "429 RESOURCE_EXHAUSTED". */
  code: z.string().nullish(),
});
export type ProgressEvent = z.infer<typeof progressEventSchema>;

/** Sent once at the start of a run: every step it expects to take, in order. */
export const planEventSchema = z.object({
  steps: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type PlanStep = z.infer<typeof planEventSchema>["steps"][number];

export const tokenEventSchema = z.object({ worker: z.string(), text: z.string() });
export const errorEventSchema = z.object({ code: z.string(), message: z.string() });

export type StreamEvent =
  | { kind: "plan"; steps: PlanStep[] }
  | { kind: "progress"; data: ProgressEvent }
  | { kind: "token"; worker: string; text: string }
  | { kind: "token_reset" }
  | { kind: "result"; data: RunResult }
  | { kind: "error"; code: string; message: string };

/** The API's error envelope: {"error": {code, message, details}} */
export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

// --- Auth & history ---------------------------------------------------------------------

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  created_at: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const historyItemSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: z.enum(["completed", "partial", "failed"]),
  selected_sections: z.array(z.enum(SECTIONS)),
  jd_snippet: z.string(),
  candidate_name: z.string().nullable(),
  match_score_before: z.number().nullable(),
  match_score_after: z.number().nullable(),
  ats_score: z.number().nullable(),
  cover_letter_count: z.number(),
});
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const historyPageSchema = z.object({
  items: z.array(historyItemSchema),
  next_cursor: z.string().nullable(),
});

export const historyDetailSchema = historyItemSchema.extend({
  jd_text: z.string(),
  original_resume: structuredResumeSchema.nullable(),
  /** The user's edit if there is one, else the AI's resume. */
  customized_resume: structuredResumeSchema.nullable(),
  /** The AI's resume, to reset to. */
  ai_resume: structuredResumeSchema.nullable(),
  resume_edited: z.boolean(),
  highlighted_skills: z.array(z.string()),
  errors: z.array(z.string()),
  cover_letters: z.array(
    z.object({
      /** The user's edit if there is one, else the AI's letter. */
      content: z.string(),
      ai_content: z.string(),
      edited: z.boolean(),
      /** Claims the fact-check still flagged in the AI's letter. */
      issues: z.array(guardrailIssueSchema),
      /** False for letters saved before the check existed, or when the check failed. */
      fact_checked: z.boolean(),
      created_at: z.string(),
    }),
  ),
});
export type HistoryDetail = z.infer<typeof historyDetailSchema>;

/** Validate the sign-up / log-in form the same way the API does. */
export function validateCredentials(
  username: string,
  password: string,
): { username?: string; password?: string } {
  const errors: { username?: string; password?: string } = {};
  const name = username.trim().toLowerCase();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX || !/^[a-z0-9_-]+$/.test(name)) {
    errors.username = `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters: lowercase letters, numbers, underscores or hyphens.`;
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    errors.password = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters long.`;
  }
  return errors;
}

// --- Admin ------------------------------------------------------------------------------

export const adminSessionSchema = z.object({
  name: z.string(),
  method: z.enum(["password", "keyword"]),
});
export type AdminSession = z.infer<typeof adminSessionSchema>;

export const statsSchema = z.object({
  registered_users: z.number(),
  registered_admins: z.number(),
  guest_users: z.number(),
  resume_runs: z.number(),
  cover_letter_runs: z.number(),
  llm_calls: z.number(),
  embedding_calls: z.number(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
  estimated_cost_usd: z.number().nullable(),
  pricing_configured: z.boolean(),
});
export type Stats = z.infer<typeof statsSchema>;

export const adminUsersPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      username: z.string(),
      created_at: z.string(),
      resume_runs: z.number(),
      cover_letter_runs: z.number(),
    }),
  ),
  next_cursor: z.string().nullable(),
});
export type AdminUsersPage = z.infer<typeof adminUsersPageSchema>;
