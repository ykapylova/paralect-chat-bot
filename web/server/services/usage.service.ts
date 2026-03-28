import { usageRepository } from "../repositories/usage.repository";

const FREE_QUESTION_LIMIT = 3;

export const usageService = {
  freeLimit: FREE_QUESTION_LIMIT,

  async getUsedQuestions(sessionId: string): Promise<number> {
    return usageRepository.getQuestionCount(sessionId);
  },

  async getUsage(sessionId: string) {
    const usedQuestions = await usageRepository.getQuestionCount(sessionId);
    return {
      sessionId,
      freeLimit: FREE_QUESTION_LIMIT,
      usedQuestions,
      remainingQuestions: Math.max(0, FREE_QUESTION_LIMIT - usedQuestions),
    };
  },

  async incrementQuestion(sessionId: string) {
    await usageRepository.incrementQuestionCount(sessionId);
    return this.getUsage(sessionId);
  },

  async hasAnonymousQuota(sessionId: string): Promise<boolean> {
    const used = await usageRepository.getQuestionCount(sessionId);
    return used < FREE_QUESTION_LIMIT;
  },
};
