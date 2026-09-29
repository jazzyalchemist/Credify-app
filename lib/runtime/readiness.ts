import { accessKeyConfigured } from "@/lib/auth/session";
import { databaseConfigured } from "@/lib/db/client";
import { researchModel } from "@/lib/ai/openai";
import {
  canonicalProtocolManifest,
  loadCanonicalInitialProtocol,
} from "@/lib/protocol/canonical";
import { PROTOCOL } from "@/lib/protocol/manifest";

export interface RuntimeReadiness {
  authentication: boolean;
  database: boolean;
  canonicalProtocol: boolean;
  openAi: boolean;
  aiResearchReady: boolean;
  manualInvestigationReady: boolean;
  model: string;
  protocol: {
    version: string;
    commit: string;
    repository: string;
  };
  notes: string[];
}

export async function getRuntimeReadiness(): Promise<RuntimeReadiness> {
  const authentication = accessKeyConfigured();
  const database = databaseConfigured();
  const openAi = Boolean(process.env.OPENAI_API_KEY);
  let canonicalProtocol = false;
  const notes: string[] = [];

  try {
    const loaded = await loadCanonicalInitialProtocol();
    canonicalProtocol =
      loaded.includes(PROTOCOL.commit) &&
      canonicalProtocolManifest().bundledFallbackIntegrity ===
        "git-blob-sha1";
  } catch (error) {
    notes.push(
      "Canonical protocol verification failed: " +
        (error instanceof Error ? error.message : "unknown error"),
    );
  }

  if (!database) {
    notes.push(
      "PostgreSQL is not connected; persistent investigations are unavailable.",
    );
  }
  if (!authentication) {
    notes.push(
      "Private app authentication is not fully configured.",
    );
  }
  if (!openAi) {
    notes.push(
      "OPENAI_API_KEY is not configured; manual investigation remains possible, but AI research stages cannot run.",
    );
  }
  if (!canonicalProtocol) {
    notes.push(
      "AI research is disabled until the pinned methodology passes integrity verification.",
    );
  }

  return {
    authentication,
    database,
    canonicalProtocol,
    openAi,
    manualInvestigationReady: authentication && database && canonicalProtocol,
    aiResearchReady:
      authentication && database && canonicalProtocol && openAi,
    model: researchModel(),
    protocol: {
      version: PROTOCOL.version,
      commit: PROTOCOL.commit,
      repository: PROTOCOL.repository,
    },
    notes,
  };
}
