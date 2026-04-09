-- DropForeignKey
ALTER TABLE "Automation" DROP CONSTRAINT "Automation_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationLog" DROP CONSTRAINT "AutomationLog_automationId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Sprint" DROP CONSTRAINT "Sprint_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_parentTaskId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_sprintId_fkey";

-- DropForeignKey
ALTER TABLE "TaskActivity" DROP CONSTRAINT "TaskActivity_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskActivity" DROP CONSTRAINT "TaskActivity_userId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "Workflow" DROP CONSTRAINT "Workflow_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Workflow" DROP CONSTRAINT "Workflow_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowApproval" DROP CONSTRAINT "WorkflowApproval_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowApproval" DROP CONSTRAINT "WorkflowApproval_executionId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowExecution" DROP CONSTRAINT "WorkflowExecution_workflowId_fkey";

-- DropTable
DROP TABLE "Automation";

-- DropTable
DROP TABLE "AutomationLog";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "ProjectMember";

-- DropTable
DROP TABLE "Sprint";

-- DropTable
DROP TABLE "Task";

-- DropTable
DROP TABLE "TaskActivity";

-- DropTable
DROP TABLE "TimeEntry";

-- DropTable
DROP TABLE "Workflow";

-- DropTable
DROP TABLE "WorkflowApproval";

-- DropTable
DROP TABLE "WorkflowExecution";
