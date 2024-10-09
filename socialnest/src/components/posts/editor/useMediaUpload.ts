import { useToast } from "@/components/ui/use-toast";
import { useUploadThing } from "@/lib/uploadthing";
import { useState } from "react";

export interface Attachment {
  file: File;
  mediaId?: string;
  isUploading: boolean;
}

export default function useMediaUpload() {
  const { toast } = useToast(); // Notification handler
  const [attachments, setAttachment] = useState<Attachment[]>([]); // Stores uploaded files
  const [uploadProgress, setUploadProgress] = useState<number>(); // Tracks upload progress

  // Upload handler with renaming logic
  const { startUpload, isUploading } = useUploadThing("attachment", {
    onBeforeUploadBegin(files) {
      // Rename files with unique IDs
      const renamedFiles = files.map((file) => {
        const extension = file.name.split(".").pop();
        return new File(
          [file],
          `attachment_${crypto.randomUUID()}.${extension}`,
          { type: file.type },
        );
      });

      // Add files to attachment state
      setAttachment((prev) => [
        ...prev,
        ...renamedFiles.map((file) => ({ file, isUploading: true })),
      ]);

      return renamedFiles;
    },
    onUploadProgress: setUploadProgress, // Updates progress
    onClientUploadComplete(res) {
      // Updates attachment state when upload completes
      setAttachment((prev) =>
        prev.map((a) => {
          const uploadResult = res.find((r) => r.name === a.file.name);
          return uploadResult
            ? {
                ...a,
                mediaId: uploadResult.serverData.mediaId,
                isUploading: false,
              }
            : a;
        }),
      );
    },
    onUploadError(e) {
      // Remove failed uploads and show error toast
      setAttachment((prev) => prev.filter((a) => !a.isUploading));
      toast({ variant: "destructive", description: e.message });
    },
  });

  // Starts file upload, validates attachment count
  function handleStartUpload(files: File[]) {
    if (isUploading) {
      toast({
        variant: "destructive",
        description: "Please wait for the current upload to finish.",
      });
      return;
    }
    if (attachments.length + files.length > 5) {
      toast({
        variant: "destructive",
        description: "You can only upload up to 5 attachments per post.",
      });
      return;
    }
    startUpload(files);
  }

  // Removes file from attachment state
  function removeAttachment(fileName: string) {
    setAttachment((prev) => prev.filter((a) => a.file.name !== fileName));
  }

  // Resets attachments and progress
  function reset() {
    setAttachment([]);
    setUploadProgress(undefined);
  }

  return {
    startUpload: handleStartUpload,
    attachments,
    isUploading,
    uploadProgress,
    removeAttachment,
    reset,
  };
}
