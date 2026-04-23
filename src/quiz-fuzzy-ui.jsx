import { h, render as preactRender } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

function FuzzyOption({ option, highlighted, onSelect }) {
  const classes = ['px-4', 'py-3', 'rounded-lg', 'border-2', 'transition', 'text-left', 'leading-relaxed'];
  if (highlighted) {
    classes.push('bg-blue-200', 'border-blue-500');
  } else {
    classes.push('bg-gray-100', 'hover:bg-gray-200', 'border-gray-300');
  }
  if (option.className) {
    classes.push(option.className);
  }
  if (option.disabled) {
    classes.push('opacity-50', 'cursor-not-allowed');
  }

  if (option.htmlContent) {
    return (
      <button
        type="button"
        className={classes.join(' ')}
        disabled={option.disabled}
        onClick={() => !option.disabled && onSelect(option.value)}
        dangerouslySetInnerHTML={{ __html: option.htmlContent }}
      />
    );
  }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={option.disabled}
      onClick={() => !option.disabled && onSelect(option.value)}
    >
      {option.label || option.value}
    </button>
  );
}

function CharPinyinOption({ option, highlighted, onSelect }) {
  const classes = ['quiz-char-pinyin-choice', 'px-4', 'py-3', 'rounded-lg', 'border-2', 'transition'];
  if (highlighted) {
    classes.push('bg-blue-200', 'border-blue-500');
  } else {
    classes.push('bg-gray-100', 'hover:bg-gray-200', 'border-gray-300');
  }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={option.disabled}
      onClick={() => !option.disabled && onSelect(option.char)}
    >
      <span className="quiz-char-pinyin-choice-char">{option.char}</span>
      <span className="quiz-char-pinyin-choice-meta">
        <span className="quiz-char-pinyin-choice-pinyin">{option.pinyinDisplay || option.pinyin}</span>
      </span>
    </button>
  );
}

function FuzzyModeView({
  options,
  inputValue,
  inputPlaceholder,
  disabled,
  highlightedIndex,
  onInputChange,
  onSubmit,
  onSelect,
  onKeyDown,
  optionType
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [disabled]);

  const OptionComponent = optionType === 'char-pinyin' ? CharPinyinOption : FuzzyOption;

  return (
    <div id="fuzzyMode" style={{ display: 'block' }}>
      <div className="fuzzy-input-row">
        <input
          ref={inputRef}
          id="fuzzyInput"
          type="text"
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
          value={inputValue}
          placeholder={inputPlaceholder || 'Type to filter...'}
          disabled={disabled}
          onInput={(e) => onInputChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
            if (onKeyDown) onKeyDown(e);
          }}
        />
      </div>
      <div id="fuzzyOptions" className="flex flex-col gap-2 mt-2">
        {options.map((option, index) => (
          <OptionComponent
            key={option.key || option.char || index}
            option={option}
            highlighted={index === highlightedIndex}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<FuzzyModeView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeQuizFuzzyUI = {
  render,
  unmount
};
