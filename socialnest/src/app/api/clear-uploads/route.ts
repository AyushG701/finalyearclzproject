import prisma from "@/lib/prisma";
import { UTApi } from "uploadthing/server";

export async function GET(req: Request) {
  try {
    // Extract the Authorization header from the request
    const authHeader = req.headers.get("Authorization");

    // Check if the Authorization header matches the expected secret
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json(
        { message: "Invalid authorization header" },
        { status: 401 }, // Return 401 if authorization fails
      );
    }

    // Query the database for unused media items
    const unusedMedia = await prisma.media.findMany({
      where: {
        postId: null, // Only select media with no associated post
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 1000 * 60 * 60 * 24), // In production, only select items older than 24 hours
              },
            }
          : {}), // If not in production, include all unused media
      },
      select: {
        id: true, // Select the media ID
        url: true, // Select the media URL
      },
    });

    // Extract the file identifiers from the URLs for deletion
    const fileIdentifiers = unusedMedia.map(
      (m) =>
        m.url.split(`/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`)[1],
    );

    // Ensure to await the deletion of files from Uploadthing
    await new UTApi().deleteFiles(fileIdentifiers);

    // Delete the unused media records from the database
    await prisma.media.deleteMany({
      where: {
        id: {
          in: unusedMedia.map((m) => m.id), // Specify IDs of media to delete
        },
      },
    });

    // Return a success message indicating that unused media was deleted
    return Response.json(
      { message: "Unused media deleted successfully." },
      { status: 200 },
    );
  } catch (error) {
    // Log any errors that occur during the process for debugging
    console.error("Error deleting unused media:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 }); // Return a 500 status for server errors
  }
}
