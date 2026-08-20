interface UploadButtonProps {
  label: string;
  onFile: (file: File) => void;
}

export function UploadButton({ label, onFile }: UploadButtonProps) {
  return (
    // The reference hides the input with `display: none`, which takes it out
    // of the tab order too. Here it stays focusable and is hidden visually
    // instead, so the label can mirror its focus ring.
    <label className="upload-button">
      {label}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
