"use client";

type ErrorMessageProps = {
  message: string;
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorMessage({
  message,
  title = "Something went wrong",
  retryLabel = "Try again",
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="card errorMessage" role="alert">
      <p className="errorMessageTitle">{title}</p>
      <p>{message}</p>
      {onRetry ? (
        <button
          className="button errorMessageAction"
          type="button"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
