export interface SubjectData {
  id: string;
  name: string;
  requiredMinutesBeginner: number;
  requiredMinutesExperienced: number;
}

export async function fetchSubjects(): Promise<SubjectData[]> {
  const response = await fetch("/api/admin/subjects");
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "科目一覧の取得に失敗しました");
  }
  const body = await response.json();
  return body.subjects as SubjectData[];
}
