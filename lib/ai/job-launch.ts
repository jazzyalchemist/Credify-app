import {
  createAiJob,
  type AiJobRecord,
  type AiJobStatus,
} from "@/lib/db/ai-jobs";
import { appendAuditEvent } from "@/lib/db/repository";
import {
  cancelBackgroundResponse,
  type OpenAIResponse,
} from "@/lib/ai/openai";

export async function persistBackgroundJobOrCancel(input: {
  investigationId: string;
  jobType: string;
  response: OpenAIResponse;
  fallbackModel: string;
  status: AiJobStatus;
  requestPayload: unknown;
  redteamReviewId?: string | null;
  subjectId?: string | null;
}): Promise<AiJobRecord> {
  try {
    return await createAiJob({
      investigationId: input.investigationId,
      jobType: input.jobType,
      externalResponseId: input.response.id,
      model: input.response.model || input.fallbackModel,
      status: input.status,
      requestPayload: input.requestPayload,
      redteamReviewId: input.redteamReviewId,
      subjectId: input.subjectId,
    });
  } catch (error) {
    let cancellationError: string | null = null;

    try {
      await cancelBackgroundResponse(input.response.id);
    } catch (cancelError) {
      cancellationError =
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel orphaned background response.";
    }

    const persistenceError =
      error instanceof Error
        ? error.message
        : "Unable to persist AI background job.";

    await appendAuditEvent(
      input.investigationId,
      "AI_JOB_PERSISTENCE_REJECTED",
      {
        jobType: input.jobType,
        subjectId: input.subjectId ?? null,
        redteamReviewId: input.redteamReviewId ?? null,
        responseId: input.response.id,
        persistenceError,
        cancellationError,
      },
    );

    throw new Error(
      "The AI run could not be registered, usually because another equivalent run already exists. The unowned background response was cancelled when possible.",
    );
  }
}
