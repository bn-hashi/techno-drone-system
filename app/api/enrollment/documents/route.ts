import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";
import { UserRole } from "@/types/prisma";

const DOCUMENT_SUBDIRECTORIES = {
  idDocument: "id-documents",
  photo: "photos",
  experienceCert: "experience-certs",
} as const;

type DocumentFieldName = keyof typeof DOCUMENT_SUBDIRECTORIES;

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user || session.user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = session.user.id;

  const formData = await request.formData();

  const fileEntries = (Object.keys(DOCUMENT_SUBDIRECTORIES) as DocumentFieldName[])
    .map((field) => ({ field, file: formData.get(field) as File | null }))
    .filter(({ file }) => file !== null && file.size > 0);

  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "ファイルが1件も提供されていません" }, { status: 400 });
  }

  const prisma = getPrisma();
  const application = await prisma.enrollmentApplication.findUnique({
    where: { userId },
  });

  if (!application) {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  }

  const savedPaths: Partial<Record<DocumentFieldName, string>> = {};
  for (const { field, file } of fileEntries) {
    const savedPath = await saveUploadedFile(file as File, DOCUMENT_SUBDIRECTORIES[field]);
    savedPaths[field] = savedPath;
  }

  await prisma.enrollmentApplication.update({
    where: { id: application.id },
    data: {
      ...(savedPaths.idDocument && { idDocumentPath: savedPaths.idDocument }),
      ...(savedPaths.photo && { photoPath: savedPaths.photo }),
      ...(savedPaths.experienceCert && { experienceCertPath: savedPaths.experienceCert }),
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
