import { useState, useEffect, useCallback, useRef } from 'react';

interface SlugValidationResult {
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
  checkedSlug: string | null;
}

/**
 * Custom hook for real-time slug validation
 * Checks if a campaign slug is available with debouncing
 */
export function useSlugValidation(slug: string, delay: number = 500): SlugValidationResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedSlug, setCheckedSlug] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const checkSlugAvailability = useCallback(async (slugToCheck: string) => {
    // Skip if slug is empty or too short
    if (!slugToCheck || slugToCheck.length < 3) {
      setIsChecking(false);
      setIsAvailable(null);
      setError(null);
      setCheckedSlug(null);
      return;
    }

    // Validate format locally first
    if (!/^[a-z0-9-]+$/.test(slugToCheck)) {
      setIsChecking(false);
      setIsAvailable(false);
      setError('URL must contain only lowercase letters, numbers, and hyphens');
      setCheckedSlug(slugToCheck);
      return;
    }

    if (slugToCheck.length > 50) {
      setIsChecking(false);
      setIsAvailable(false);
      setError('URL cannot exceed 50 characters');
      setCheckedSlug(slugToCheck);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/check-slug?slug=${encodeURIComponent(slugToCheck)}`);
      const data = await response.json();

      if (response.ok) {
        setIsAvailable(data.available);
        setCheckedSlug(slugToCheck);
        if (!data.available) {
          setError('This URL is already taken. Please choose another.');
        }
      } else {
        setError(data.error || 'Failed to check URL availability');
        setIsAvailable(null);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Trigger validation when slug changes with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Reset states if slug is too short
    if (!slug || slug.length < 3) {
      setIsChecking(false);
      setIsAvailable(null);
      setError(null);
      setCheckedSlug(null);
      return;
    }

    // Show checking state immediately for better UX
    setIsChecking(true);
    setError(null);

    // Set new timeout for debounced check
    timeoutRef.current = setTimeout(() => {
      checkSlugAvailability(slug);
    }, delay);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [slug, delay, checkSlugAvailability]);

  return {
    isChecking,
    isAvailable,
    error,
    checkedSlug
  };
}