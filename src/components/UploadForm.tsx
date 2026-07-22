import { useEffect, useRef, useState, type FormEvent } from 'react';
import { listMyEntries, uploadEntry } from '../services/entries';
import type { Entry } from '../types';
import './entry-management.css';

const MAX_ENTRIES = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface UploadFormProps {
  competitionId: string;
  onUploaded?: (entry: Entry) => void;
}

export function UploadForm({ competitionId, onUploaded }: UploadFormProps) {
  const [entryCount, setEntryCount] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, MAX_ENTRIES - entryCount);
  const atLimit = remaining === 0;

  useEffect(() => {
    let active = true;
    setIsLoadingCount(true);
    setCountError(null);
    void listMyEntries(competitionId).then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setCountError(result.error);
      } else {
        setEntryCount(result.data.length);
      }
      setIsLoadingCount(false);
    });
    return () => {
      active = false;
    };
  }, [competitionId]);

  function handleFileChange(selectedFile: File | undefined) {
    setError(null);
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError('Image exceeds the 25 MB limit.');
      return;
    }
    setFile(selectedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose an image to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Enter a title for your photo.');
      return;
    }
    if (atLimit) {
      setError("You've reached the 5-photo limit.");
      return;
    }

    setIsUploading(true);
    const result = await uploadEntry(competitionId, file, title.trim());
    setIsUploading(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }

    setEntryCount((count) => count + 1);
    setFile(null);
    setTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onUploaded?.(result.data);
  }

  const disabled = isLoadingCount || isUploading || atLimit || countError !== null;

  return (
    <section className="entry-panel" aria-labelledby="upload-photo-heading">
      <div className="entry-panel__heading">
        <div>
          <p className="entry-panel__eyebrow">Your submission</p>
          <h2 id="upload-photo-heading">Upload a photo</h2>
        </div>
        <strong aria-live="polite">
          {isLoadingCount
            ? 'Checking limit…'
            : countError
              ? 'Limit unavailable'
              : `${remaining} of ${MAX_ENTRIES} remaining`}
        </strong>
      </div>

      {countError && (
        <p className="entry-error" role="alert">
          Unable to check your remaining uploads: {countError}
        </p>
      )}

      {atLimit && (
        <p className="entry-warning" role="status">
          You've reached the 5-photo limit. Rejected photos still count toward this limit.
        </p>
      )}

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="entry-field">
          <label htmlFor="entry-file">Photo</label>
          <input
            ref={fileInputRef}
            id="entry-file"
            type="file"
            accept="image/*,.heic,.heif"
            disabled={disabled}
            onChange={(event) => handleFileChange(event.target.files?.[0])}
          />
          <p className="entry-help">
            JPEG, PNG, WebP, HEIC or HEIF; up to 25 MB and at least 2000px on the long edge.
          </p>
        </div>

        <div className="entry-field">
          <label htmlFor="entry-title">Photo title</label>
          <input
            id="entry-title"
            type="text"
            value={title}
            maxLength={120}
            disabled={disabled}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        {error && (
          <p className="entry-error" role="alert">
            {error}
          </p>
        )}

        <button className="entry-button entry-button--primary entry-form__submit" disabled={disabled}>
          {isUploading && <span className="entry-spinner" aria-hidden="true" />}
          {isUploading ? 'Uploading…' : atLimit ? 'Upload limit reached' : 'Upload photo'}
        </button>
      </form>
    </section>
  );
}
