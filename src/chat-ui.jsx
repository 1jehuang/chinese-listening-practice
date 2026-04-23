import { h, Fragment, render as preactRender } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ChatMessage({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
        isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
      }`}>
        <div className="text-xs mb-1 opacity-70">{isUser ? 'You' : 'Assistant'}</div>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-lg text-sm">
        Thinking...
      </div>
    </div>
  );
}

function ChatPanelView({
  visible,
  messages,
  typing,
  inputValue,
  onInputChange,
  onSend,
  onClose,
  onToggle
}) {
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div
      id="chatPanel"
      className="fixed top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col z-50"
      style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.2s ease' }}
    >
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Quiz Chat</div>
          <div className="text-xs text-gray-500">Ask about the current question</div>
        </div>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close (Ctrl+H or Esc)"
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div ref={messagesRef} id="chatMessages" className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {typing ? <TypingIndicator /> : null}
      </div>
      <div className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            id="chatInput"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Ask a question... (Enter to send)"
            value={inputValue}
            onInput={(e) => onInputChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button
            type="button"
            id="chatSendBtn"
            className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition"
            onClick={onSend}
          >
            Send
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">Ctrl+H to focus quiz • Ctrl+L to focus chat</div>
      </div>
    </div>
  );
}

function DictationChatView({
  messages,
  typing,
  inputValue,
  promptText,
  promptSource,
  score,
  total,
  accuracy,
  onInputChange,
  onSend,
  onSkip,
  onNext,
  onTogglePromptSource,
  audioSlot
}) {
  const messagesRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div className="dictation-chat-container flex flex-col h-full">
      <div className="dictation-chat-header flex items-center gap-2 p-2 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            type="button"
            className={`px-2 py-1 text-xs rounded ${promptSource === 'system' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => onTogglePromptSource('system')}
          >
            System
          </button>
          <button
            type="button"
            className={`px-2 py-1 text-xs rounded ${promptSource === 'ai' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => onTogglePromptSource('ai')}
          >
            AI Prompt
          </button>
        </div>
        {promptText ? <div className="text-xs text-gray-500 flex-1 truncate">{promptText}</div> : null}
        <div className="text-xs text-gray-500">
          {score}/{total} ({accuracy}%)
        </div>
      </div>
      {audioSlot ? <div id="dictationChatAudioSlot" dangerouslySetInnerHTML={{ __html: audioSlot }} /> : null}
      <div ref={messagesRef} className="dictation-chat-messages flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {typing ? <TypingIndicator /> : null}
      </div>
      <div className="dictation-chat-input p-2 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Type your answer..."
            value={inputValue}
            onInput={(e) => onInputChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button type="button" className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600" onClick={onSend}>
            Send
          </button>
          <button type="button" className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300" onClick={onSkip}>
            Skip
          </button>
          {onNext ? (
            <button type="button" className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600" onClick={onNext}>
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<ChatPanelView {...props} />, container);
}

function renderDictation(container, props) {
  if (!container) return;
  preactRender(<DictationChatView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeChatUI = {
  render,
  renderDictation,
  unmount
};
