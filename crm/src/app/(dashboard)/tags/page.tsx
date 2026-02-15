import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { customers: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">タグ管理</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tags.map((tag) => (
          <Card key={tag.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium">{tag.label}</span>
                </div>
                <Badge variant="outline">{tag._count.customers}名</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <span className="font-mono">{tag.slug}</span>
                {tag.isAuto && <span className="ml-2">(自動付与)</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
