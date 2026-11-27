import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type { ChatMessage, ChatSuggestedAction } from '../../types/baymini';
import {
  buildSessionContextSummary,
  detectChatEmergency,
  getDynamicStarterChips,
  parseFormattedChatBlocks,
} from '../../utils/chatbot';
import { sendChatMessageRequest } from '../../services/chatbotApi';

export function FloatingChatbot() {
  const {
    activeView,
    navigateTo,
    navigateToDoctorsWithSpecialty,
    healthProfile,
    healthPlan,
    symptomAssessment,
    bookings,
    upcomingBookingsCount,
    chatMessages,
    addChatMessage,
    clearChatMessages,
  } = useBaymini();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sessionContext = useMemo(
    () =>
      buildSessionContextSummary({
        healthProfile,
        healthPlan,
        symptomAssessment,
        bookings,
      }),
    [healthProfile, healthPlan, symptomAssessment, bookings]
  );

  const starterChips = useMemo(
    () =>
      getDynamicStarterChips({
        healthPlan,
        symptomAssessment,
        upcomingBookingsCount,
      }),
    [healthPlan, symptomAssessment, upcomingBookingsCount]
  );

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen, sending]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sendMessage = async (rawText: string, isRetry = false) => {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;

    setErrorMessage(null);
    setFailedPrompt(null);

    const clientEmergency = detectChatEmergency(trimmed);

    const historyForRequest = [...chatMessages];
    if (!isRetry) {
      const userMessage: ChatMessage = {
        id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
        contextView: activeView,
      };
      addChatMessage(userMessage);
      setInput('');
    }

    setSending(true);
    try {
      const normalized = await sendChatMessageRequest({
        message: trimmed,
        history: historyForRequest,
        sessionContext,
        activeView,
        clientEmergencyFlag: clientEmergency.isEmergency,
      });

      const assistantMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: normalized.reply,
        timestamp: new Date().toISOString(),
        contextView: activeView,
        isEmergency: normalized.isEmergency,
        suggestedActions: normalized.suggestedActions,
      };
      addChatMessage(assistantMessage);
    } catch (err) {
      if (clientEmergency.isEmergency) {
        const emergencyFallback: ChatMessage = {
          id: `msg-ai-er-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content:
            'Your message mentions symptoms that may require immediate medical care. Please call your local emergency number or visit the nearest emergency hospital right away.',
          timestamp: new Date().toISOString(),
          contextView: activeView,
          isEmergency: true,
          suggestedActions: [
            {
              label: 'Find Emergency Hospitals',
              targetView: 'doctors',
              specialtyHint: 'Emergency Hospital',
            },
          ],
        };
        addChatMessage(emergencyFallback);
      } else {
        setFailedPrompt(trimmed);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not reach Baymini Health Assistant right now.'
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handleActionChipClick = (action: ChatSuggestedAction) => {
    if (action.targetView === 'doctors' && action.specialtyHint) {
      navigateToDoctorsWithSpecialty(action.specialtyHint);
    } else {
      navigateTo(action.targetView);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="no-print">
      {/* Frosted-Glass Chat Panel */}
      {isOpen && (
        <section
          aria-label="Baymini Health Assistant"
          className="fixed z-50 inset-x-3 bottom-20 sm:inset-x-auto sm:right-5 sm:bottom-20 sm:w-[380px] max-h-[75vh] sm:max-h-[560px] flex flex-col rounded-2xl border border-bm-border bg-white/92 dark:bg-[#101E17]/92 backdrop-blur-md shadow-[0_18px_50px_rgba(13,24,19,0.16)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.55)] overflow-hidden"
        >
          {/* Header */}
          <header className="px-4 py-3.5 border-b border-bm-border flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-bm-text truncate">
                  Baymini Health Assistant
                </h2>
                <p className="text-[11px] text-bm-text-muted truncate">
                  Health &amp; wellness guidance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearChatMessages();
                    setErrorMessage(null);
                    setFailedPrompt(null);
                  }}
                  aria-label="Clear chat history"
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-bm-text-muted hover:text-bm-text hover:bg-bm-tint inline-flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat panel"
                className="w-8 h-8 rounded-full hover:bg-bm-tint text-bm-text-muted hover:text-bm-text flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Subtle Disclaimer Strip */}
          <div className="px-4 py-2 border-b border-bm-border bg-bm-surface-subtle/75 text-[11px] text-bm-text-muted shrink-0">
            General health info only — not a substitute for professional medical advice.
          </div>

          {/* Conversation Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 min-h-[220px]">
            {chatMessages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-bm-border bg-bm-surface px-4 py-3.5 text-sm leading-relaxed text-bm-text">
                  Hi, I am your Baymini assistant. Ask me about daily routines, local meals, sleep habits, or symptoms in any language.
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-bm-text-muted px-0.5">
                    Suggested questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {starterChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => void sendMessage(chip)}
                        className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text text-left px-3.5 py-1.5 text-xs font-medium transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                const blocks = parseFormattedChatBlocks(msg.content);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isUser ? 'items-end' : 'items-start'
                    } space-y-2`}
                  >
                    {/* Emergency Warning Banner inside chat */}
                    {!isUser && msg.isEmergency && (
                      <div
                        role="alert"
                        className="w-full rounded-xl border border-bm-emergency/45 bg-bm-emergency/10 px-3.5 py-2.5 flex items-start gap-2.5"
                      >
                        <ShieldAlert
                          className="w-4 h-4 text-bm-emergency dark:text-[#F27474] shrink-0 mt-0.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <p className="text-xs leading-relaxed text-bm-text">
                          <span className="font-semibold text-bm-emergency dark:text-[#F27474]">
                            Urgent safety alert:
                          </span>{' '}
                          Please call local emergency services or visit the nearest emergency hospital immediately.
                        </p>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        isUser
                          ? 'bg-bm-primary text-white dark:text-[#0D1813] font-medium rounded-br-md'
                          : 'border border-bm-border bg-bm-surface text-bm-text rounded-bl-md space-y-2'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      ) : (
                        blocks.map((block, bIdx) =>
                          block.type === 'paragraph' ? (
                            <p key={bIdx} className="break-words">
                              {block.segments.map((seg, sIdx) =>
                                seg.bold ? (
                                  <strong key={sIdx} className="font-semibold">
                                    {seg.text}
                                  </strong>
                                ) : (
                                  <span key={sIdx}>{seg.text}</span>
                                )
                              )}
                            </p>
                          ) : (
                            <ul
                              key={bIdx}
                              className="space-y-1 pl-4 list-disc break-words"
                            >
                              {block.items.map((itemSegs, iIdx) => (
                                <li key={iIdx}>
                                  {itemSegs.map((seg, sIdx) =>
                                    seg.bold ? (
                                      <strong key={sIdx} className="font-semibold">
                                        {seg.text}
                                      </strong>
                                    ) : (
                                      <span key={sIdx}>{seg.text}</span>
                                    )
                                  )}
                                </li>
                              ))}
                            </ul>
                          )
                        )
                      )}
                    </div>

                    {/* Actionable Navigation Chips */}
                    {!isUser &&
                      msg.suggestedActions &&
                      msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-w-[92%]">
                          {msg.suggestedActions.map((action, idx) => {
                            const isEmergencyChip =
                              action.specialtyHint
                                ?.toLowerCase()
                                .includes('emergency') ||
                              action.label.toLowerCase().includes('emergency');

                            return (
                              <button
                                key={`${action.label}-${idx}`}
                                type="button"
                                onClick={() => handleActionChipClick(action)}
                                className={`rounded-full border px-3 py-1 text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                                  isEmergencyChip
                                    ? 'border-bm-emergency/50 bg-bm-emergency text-white hover:opacity-90'
                                    : 'border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-primary'
                                }`}
                              >
                                <span>{action.label}</span>
                                <ArrowRight
                                  className="w-3 h-3"
                                  strokeWidth={1.75}
                                  aria-hidden="true"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                  </div>
                );
              })
            )}

            {/* Calm Typing Indicator */}
            {sending && (
              <div className="flex items-start">
                <div
                  aria-label="Baymini is typing"
                  className="rounded-2xl rounded-bl-md border border-bm-border bg-bm-surface px-4 py-3 inline-flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-bm-primary/60 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-bm-primary/60 animate-pulse [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-bm-primary/60 animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Graceful Error + Retry */}
            {errorMessage && (
              <div className="rounded-xl border border-bm-prompt/35 bg-bm-surface px-3.5 py-2.5 text-xs text-bm-text-muted flex items-center justify-between gap-3">
                <span>{errorMessage}</span>
                {failedPrompt && (
                  <button
                    type="button"
                    onClick={() => void sendMessage(failedPrompt, true)}
                    className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text px-3 py-1 font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <RefreshCw
                      className="w-3 h-3"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="p-3 border-t border-bm-border bg-bm-surface/90 flex items-end gap-2 shrink-0"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              maxLength={1200}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Ask a health question in any language..."
              aria-label="Ask a health question"
              className="flex-1 rounded-2xl border border-bm-border bg-bm-surface-subtle px-3.5 py-2 text-xs sm:text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors resize-none max-h-24 leading-snug"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="w-9 h-9 rounded-full bg-bm-primary hover:bg-bm-primary-hover disabled:opacity-45 disabled:cursor-not-allowed text-white dark:text-[#0D1813] flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {/* Fixed Bottom-Right Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? 'Close Baymini Health Assistant'
            : 'Open Baymini Health Assistant'
        }
        className="fixed bottom-5 right-5 z-40 w-13 h-13 rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] shadow-[0_8px_24px_rgba(19,34,27,0.22)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-150"
      >
        {isOpen ? (
          <X className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <MessageCircle
            className="w-5 h-5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
