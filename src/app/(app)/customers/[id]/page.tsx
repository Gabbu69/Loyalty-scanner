import { CustomerProfile } from "@/components/loyalty/customer-profile";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerProfile memberId={id} />;
}
