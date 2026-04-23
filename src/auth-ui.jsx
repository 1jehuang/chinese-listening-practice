import { h, Fragment, render as preactRender } from 'preact';
import { useState, useEffect } from 'preact/hooks';

function AuthButton({ isSignedIn, isAnonymous, avatarUrl, email, onSignIn, onSignOut }) {
  if (isSignedIn && !isAnonymous) {
    return (
      <button
        type="button"
        id="auth-btn"
        className="bg-white hover:bg-gray-100 text-gray-700 w-10 h-10 rounded-full shadow border border-gray-200 transition flex items-center justify-center"
        title={email || 'Sign out'}
        onClick={onSignOut}
      >
        {avatarUrl ? (
          <img id="auth-avatar" className="w-8 h-8 rounded-full" alt="Profile" src={avatarUrl} />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      id="auth-btn"
      className="bg-white hover:bg-gray-100 text-gray-700 w-10 h-10 rounded-full shadow border border-gray-200 transition flex items-center justify-center"
      title="Sign in"
      onClick={onSignIn}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </button>
  );
}

function AuthContainer({ inSidebar, isSignedIn, isAnonymous, avatarUrl, email, onSignIn, onSignOut }) {
  const containerClass = inSidebar ? '' : 'fixed top-4 left-28 z-50';

  return (
    <div id="auth-container" className={containerClass}>
      <AuthButton
        isSignedIn={isSignedIn}
        isAnonymous={isAnonymous}
        avatarUrl={avatarUrl}
        email={email}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<AuthContainer {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeAuthUI = {
  render,
  unmount
};
