import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { createUploadthing, FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

const f = createUploadthing();

export const fileRouter = {
  avatar: f({
    image: { maxFileSize: "512KB" },
  })
    .middleware(async () => {
      try {
        const { user } = await validateRequest();

        if (!user) {
          console.error("Unauthorized access attempt during avatar upload");
          throw new UploadThingError("Unauthorized");
        }

        return { user };
      } catch (error) {
        console.error("Error in middleware: ", error);
        throw new UploadThingError("Authentication failed");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const oldAvatarUrl = metadata.user.avatarUrl;

        // If the user already has an avatar, attempt to delete the old one
        if (oldAvatarUrl) {
          const key = oldAvatarUrl.split(
            `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
          )[1];

          try {
            await new UTApi().deleteFiles(key);
            console.log(`Old avatar deleted: ${key}`);
          } catch (deleteError) {
            console.error("Failed to delete old avatar: ", deleteError);
          }
        }

        // Update the user's avatar URL with the new one
        const newAvatarUrl = file.url.replace(
          "/f/",
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        );

        try {
          await prisma.user.update({
            where: { id: metadata.user.id },
            data: { avatarUrl: newAvatarUrl },
          });
          console.log(`User avatar updated for user ID: ${metadata.user.id}`);
        } catch (dbError) {
          console.error("Failed to update user avatar in database: ", dbError);
          throw new UploadThingError("Database update failed");
        }

        return { avatarUrl: newAvatarUrl };
      } catch (error) {
        console.error("Error during file upload completion: ", error);
        throw new UploadThingError("Upload completion failed");
      }
    }),
  attachment: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    video: { maxFileSize: "64MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      try {
        const { user } = await validateRequest();

        if (!user) {
          console.error("Unauthorized access attempt during avatar upload");
          throw new UploadThingError("Unauthorized");
        }

        return {};
      } catch (error) {
        console.error("Error in middleware: ", error);
        throw new UploadThingError("Authentication failed");
      }
    })
    .onUploadComplete(async ({ file }) => {
      const media = await prisma.media.create({
        data: {
          url: file.url.replace(
            "/f/",
            `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
          ),
          type: file.type.startsWith("image") ? "IMAGE" : "VIDEO",
        },
      });

      return { mediaId: media.id };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
