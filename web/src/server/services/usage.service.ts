const usageBySession = new Map<string, number>();

export const usageService = {
  getUsage(sessionId: string) {
    const usedQuestions = usageBySession.get(sessionId) ?? 0;
    const freeLimit = 3;
    return {
      sessionId,
      freeLimit,
      usedQuestions,
      remainingQuestions: Math.max(0, freeLimit - usedQuestions),
    };
  },

  incrementQuestion(sessionId: string) {
    const current = usageBySession.get(sessionId) ?? 0;
    usageBySession.set(sessionId, current + 1);
    return this.getUsage(sessionId);
  },
};
