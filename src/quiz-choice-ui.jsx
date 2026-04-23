import { h, render as preactRender } from 'preact';

function ChoiceButton({ option, onSelect }) {
  return (
    <button
      type="button"
      className={option.className || 'px-6 py-4 text-xl bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition'}
      onClick={() => onSelect(option.value)}
      disabled={option.disabled}
    >
      {option.label || option.value}
    </button>
  );
}

function ChoiceModeView({ options, onSelect, listLayout }) {
  return (
    <div
      id="choiceMode"
      className="choice-mode-container"
      style={{ display: 'block' }}
    >
      <div
        id="options"
        className={`flex flex-col gap-2 ${listLayout ? 'choice-mode-list' : ''}`}
      >
        {options.map((option, index) => (
          <ChoiceButton
            key={option.key || index}
            option={option}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<ChoiceModeView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeQuizChoiceUI = {
  render,
  unmount
};
