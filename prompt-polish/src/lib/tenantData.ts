import prisma from "./db";

export async function listProjects(orgId: string) {
  return prisma.project.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectById(orgId: string, projectId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      orgId,
    },
  });
}

export async function listPromptsByProject(orgId: string, projectId: string) {
  return prisma.prompt.findMany({
    where: {
      orgId,
      projectId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getPromptById(orgId: string, promptId: string) {
  return prisma.prompt.findFirst({
    where: {
      id: promptId,
      orgId,
    },
  });
}

export async function getPromptWithVersions(orgId: string, promptId: string) {
  return prisma.prompt.findFirst({
    where: {
      id: promptId,
      orgId,
    },
    include: {
      versions: {
        where: {
          orgId,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function getPromptForOptimize(orgId: string, promptId: string) {
  return prisma.prompt.findFirst({
    where: {
      id: promptId,
      orgId,
    },
    select: {
      id: true,
      orgId: true,
      rawPrompt: true,
      templateId: true,
      template: {
        select: {
          id: true,
          key: true,
          systemPrompt: true,
          updatedAt: true,
        },
      },
      projectId: true,
    },
  });
}
