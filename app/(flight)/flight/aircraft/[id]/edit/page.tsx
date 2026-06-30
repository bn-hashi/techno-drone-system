import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAircraftService } from "@/lib/serviceFactory";
import { AircraftNotFoundError } from "@/services/errors";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { AircraftForm } from "@/components/flight/aircraft/AircraftForm";
import type { AircraftDto } from "@/lib/api/aircraft";

interface EditAircraftPageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function EditAircraftPage({ params }: EditAircraftPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }

  const context = {
    userId: session.user.id,
    isAdmin: (session.user.role as UserRole) === UserRole.ADMIN,
  };

  let aircraft;
  try {
    aircraft = await getAircraftService().findById(params.id, context);
  } catch (err) {
    if (err instanceof AircraftNotFoundError) {
      notFound();
    }
    throw err;
  }

  if (!aircraft.isActive) {
    redirect(`/flight/aircraft/${params.id}`);
  }

  const initialData: AircraftDto = {
    id: aircraft.id,
    userId: aircraft.userId,
    name: aircraft.name,
    manufacturer: aircraft.manufacturer,
    modelNumber: aircraft.modelNumber,
    serialNumber: aircraft.serialNumber,
    weightGrams: aircraft.weightGrams,
    maxFlightTimeMin: aircraft.maxFlightTimeMin,
    registrationNumber: aircraft.registrationNumber,
    isActive: aircraft.isActive,
    createdAt: aircraft.createdAt.toISOString(),
    updatedAt: aircraft.updatedAt.toISOString(),
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">機体を編集</h1>
      <AircraftForm initialData={initialData} />
    </div>
  );
}
