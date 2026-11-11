import { useRef } from 'react';

/** Which footer button submitted a create form: plain "Create", or "Create & create another". */
export type SubmitIntent = 'create' | 'create-another';

/**
 * Two submit buttons, one form: each button records its intent on click, and the submit handler reads it.
 * (A native `submitter` would also work, but react-hook-form's handleSubmit does not pass it through.)
 */
export function useSubmitIntent() {
  const intentRef = useRef<SubmitIntent>('create');
  return {
    current: () => intentRef.current,
    markAs: (intent: SubmitIntent) => () => {
      intentRef.current = intent;
    },
  };
}
