import { connectToDatabase, disconnectFromDatabase } from "../config/database.js";
import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { Interview } from "../models/interview.model.js";
import { InterviewNote } from "../models/interview-note.model.js";
import { Job } from "../models/job.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import { Notification } from "../models/notification.model.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import { shiftCalendarDate, startOfCalendarInstant, todayCalendarDate } from "../utils/date-state.js";
import { generateRawToken } from "../utils/token.js";

const SEED_EMAIL_SUFFIX = "@seed.hr.test";
const APPLICATION_COUNT = 140;

const FIRST_NAMES = [
  "Amina",
  "Bilal",
  "Sara",
  "Hamza",
  "Noor",
  "Usman",
  "Zara",
  "Ali",
  "Fatima",
  "Omar",
  "Hira",
  "Danish",
  "Ayesha",
  "Hassan",
  "Rida",
];
const LAST_NAMES = ["Khan", "Ahmed", "Malik", "Raza", "Sheikh", "Iqbal", "Tariq", "Yousuf", "Farooq", "Aslam"];
const SOURCES = [
  { source: "linkedin", campaigns: ["always-on", "senior roles push"] },
  { source: "website", campaigns: ["organic", "careers seo"] },
  { source: "indeed", campaigns: ["sponsored listing"] },
  { source: "referral", campaigns: ["employee referral"] },
  { source: "facebook", campaigns: ["spring hiring drive"] },
] as const;
const STATUSES = [
  "submitted",
  "under_review",
  "interview_scheduled",
  "interviewed",
  "approved",
  "rejected",
  "trial",
] as const;
const INTERVIEW_LABELS = ["Screening call", "Technical round", "Portfolio review", "Final round", "Case study"];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function pad(value: number, size: number) {
  return String(value).padStart(size, "0");
}

function cnicFor(index: number) {
  return `${pad(10000 + (index % 90000), 5)}-${pad(1000000 + index, 7)}-${index % 10}`;
}

function descriptionDoc(title: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: `${title} opening.` }] }],
  };
}

async function ensureDemoJobs(userId: typeof User.prototype._id) {
  const existing = await Job.find({ status: { $in: ["open", "closed"] } })
    .select("title departmentId roleId status slug")
    .lean();
  if (existing.length > 0) return existing;

  const departments = [
    { name: "Engineering", icon: "cpu" },
    { name: "Design", icon: "palette" },
    { name: "Marketing", icon: "megaphone" },
    { name: "People", icon: "users" },
  ];
  const createdDepartments = await Department.insertMany(
    departments.map((item) => ({
      name: item.name,
      normalizedName: item.name.toLocaleLowerCase("en-US"),
      icon: item.icon,
      status: "active" as const,
      createdBy: userId,
    })),
  );

  const roleSpecs = [
    { dept: "Engineering", name: "Backend Engineer", title: "Backend Engineer, Node.js" },
    { dept: "Engineering", name: "Frontend Engineer", title: "Frontend Engineer, React" },
    { dept: "Design", name: "Product Designer", title: "Senior Product Designer" },
    { dept: "Marketing", name: "Growth Marketer", title: "Growth Marketer" },
    { dept: "People", name: "People Ops", title: "People Ops Specialist" },
  ];
  const deptByName = new Map(createdDepartments.map((item) => [item.name, item]));
  const roles = await Role.insertMany(
    roleSpecs.map((spec) => {
      const department = deptByName.get(spec.dept)!;
      return {
        name: spec.name,
        normalizedName: spec.name.toLocaleLowerCase("en-US"),
        departmentId: department._id,
        icon: "briefcase-business",
        status: "active" as const,
        createdBy: userId,
      };
    }),
  );

  const today = todayCalendarDate();
  const jobs = await Job.insertMany(
    roleSpecs.map((spec, index) => {
      const department = deptByName.get(spec.dept)!;
      const role = roles[index]!;
      const closed = spec.name === "People Ops";
      const publishedAt = startOfCalendarInstant(shiftCalendarDate(today, closed ? -120 : -90));
      return {
        slug: `seed-${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        title: spec.title,
        departmentId: department._id,
        roleId: role._id,
        description: descriptionDoc(spec.title),
        descriptionPlain: `${spec.title} opening.`,
        jobType: "Full-time" as const,
        salaryMin: 80_000,
        salaryMax: 180_000,
        status: closed ? ("closed" as const) : ("open" as const),
        closeReason: closed ? "Role filled during demo seeding." : null,
        applicationCount: 0,
        wizardStep: 4,
        publishedAt,
        closedAt: closed ? startOfCalendarInstant(shiftCalendarDate(today, -20)) : null,
        createdBy: userId,
      };
    }),
  );

  return jobs.map((job) => ({
    _id: job._id,
    title: job.title,
    departmentId: job.departmentId,
    roleId: job.roleId,
    status: job.status,
    slug: job.slug,
  }));
}

async function main() {
  await connectToDatabase();

  const user = await User.findOne({ role: "hr", active: true }).lean();
  if (!user) {
    throw new Error("No HR user found. Register an account first, then re-run the seed.");
  }

  const previous = await Application.find({ candidateEmail: { $regex: `${SEED_EMAIL_SUFFIX}$` } })
    .select("_id")
    .lean();
  const previousIds = previous.map((item) => item._id);
  if (previousIds.length > 0) {
    const previousInterviews = await Interview.find({ applicationId: { $in: previousIds } }).select("_id").lean();
    await InterviewNote.deleteMany({ interviewId: { $in: previousInterviews.map((item) => item._id) } });
    await Interview.deleteMany({ applicationId: { $in: previousIds } });
    await Application.deleteMany({ _id: { $in: previousIds } });
    await Notification.deleteMany({ body: { $regex: SEED_EMAIL_SUFFIX.replace(".", "\\.") } });
  }
  await LinkRegistrant.deleteMany({ email: { $regex: `${SEED_EMAIL_SUFFIX}$` } });

  const jobs = await ensureDemoJobs(user._id);
  const departments = await Department.find({ _id: { $in: jobs.map((job) => job.departmentId) } })
    .select("name")
    .lean();
  const roles = await Role.find({ _id: { $in: jobs.map((job) => job.roleId) } })
    .select("name")
    .lean();
  const departmentName = new Map(departments.map((item) => [item._id.toString(), item.name]));
  const roleName = new Map(roles.map((item) => [item._id.toString(), item.name]));

  const today = todayCalendarDate();
  const tomorrow = shiftCalendarDate(today, 1);
  const rng = mulberry32(20260905);
  const applications = [];

  for (let index = 0; index < APPLICATION_COUNT; index += 1) {
    const job = jobs[index % jobs.length]!;
    const dayOffset = Math.floor(rng() * 160);
    const date = shiftCalendarDate(today, -dayOffset);
    const createdAt = new Date(startOfCalendarInstant(date).getTime() + Math.floor(rng() * 12) * 3_600_000);
    const status = STATUSES[Math.min(STATUSES.length - 1, Math.floor(rng() * STATUSES.length))]!;
    const sourceSpec = pick(rng, SOURCES);
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const name = `${first} ${last}`;
    const history: Array<{ status: (typeof STATUSES)[number]; at: Date }> = [{ status: "submitted", at: createdAt }];
    if (status !== "submitted") {
      history.push({ status, at: new Date(createdAt.getTime() + 36 * 3_600_000) });
    }

    applications.push({
      jobId: job._id,
      roleSnapshot: {
        departmentId: job.departmentId,
        roleId: job.roleId,
        departmentName: departmentName.get(job.departmentId.toString()) ?? "Department",
        roleName: roleName.get(job.roleId.toString()) ?? "Role",
        title: job.title,
      },
      answers: [],
      experienceEntries: [
        {
          company: "Previous Co",
          title: job.title,
          startDate: "2022-01-01",
          endDate: null,
          currentlyWorking: true,
          salary: 90_000,
          description: "",
        },
      ],
      educationEntries: [
        {
          school: "University of Punjab",
          degree: "Bachelors",
          fieldOfStudy: "Business",
          cgpaPercentage: "3.4",
          startDate: "2018-01-01",
          endDate: "2022-01-01",
        },
      ],
      candidateName: name,
      candidateEmail: `${first.toLowerCase()}.${last.toLowerCase()}.${pad(index + 1, 3)}${SEED_EMAIL_SUFFIX}`,
      candidatePhone: `03${pad(100000000 + index, 9)}`.slice(0, 11),
      candidateDateOfBirth: "1996-04-12",
      candidateCnic: cnicFor(index + 1),
      candidateMaritalStatus: rng() > 0.5 ? "Single" : "Married",
      resumeUrl: "seed/resume.pdf",
      resumeOriginalName: `${first}-${last}-resume.pdf`,
      status,
      statusHistory: history,
      rejectionReason: status === "rejected" ? "Not a match for the current opening after screening." : null,
      rejectedAt: status === "rejected" ? new Date(createdAt.getTime() + 48 * 3_600_000) : null,
      decisionReason: status === "approved" ? "Strong skills and interview performance." : null,
      approvedAt: status === "approved" ? new Date(createdAt.getTime() + 72 * 3_600_000) : null,
      trialAt: status === "trial" ? new Date(createdAt.getTime() + 60 * 3_600_000) : null,
      completedInterviewCount: status === "interviewed" || status === "approved" || status === "trial" ? 1 : 0,
      source: sourceSpec.source,
      campaign: pick(rng, sourceSpec.campaigns),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const inserted = await Application.insertMany(applications);

  const interviews = [];
  const notes = [];
  let scheduledToday = 0;
  let scheduledTomorrow = 0;
  let interviewIndex = 0;
  for (const application of inserted) {
    if (application.status === "submitted" || application.status === "under_review") continue;
    const isLive = application.status === "interview_scheduled";
    const date = isLive
      ? scheduledToday < 6
        ? today
        : scheduledTomorrow < 6
          ? tomorrow
          : shiftCalendarDate(today, -2)
      : shiftCalendarDate(today, -7);
    if (isLive && date === today) scheduledToday += 1;
    if (isLive && date === tomorrow) scheduledTomorrow += 1;
    const hour = 9 + (interviewIndex % 8);
    interviewIndex += 1;
    interviews.push({
      applicationId: application._id,
      departmentId: application.roleSnapshot.departmentId,
      label: INTERVIEW_LABELS[interviewIndex % INTERVIEW_LABELS.length]!,
      date,
      time: `${pad(hour, 2)}:30`,
      durationMinutes: 45,
      status: isLive ? ("scheduled" as const) : ("completed" as const),
      createdBy: user._id,
    });
  }

  const createdInterviews = await Interview.insertMany(interviews);
  for (const interview of createdInterviews) {
    if (interview.status !== "completed") continue;
    notes.push({
      interviewId: interview._id,
      authorName: user.name,
      authorEmail: user.email,
      content: "Solid conversation. Moving forward.",
      createdAt: new Date(),
    });
  }
  if (notes.length > 0) await InterviewNote.insertMany(notes);

  const counts = await Application.aggregate<{ _id: typeof jobs[number]["_id"]; n: number }>([
    { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: "$jobId", n: { $sum: 1 } } },
  ]);
  await Promise.all(
    counts.map((row) => Job.updateOne({ _id: row._id }, { $set: { applicationCount: row.n } })),
  );

  const liveDepartments = [
    ...new Set(
      createdInterviews
        .filter((item) => item.status === "scheduled" && item.date === today)
        .map((item) => item.departmentId.toString()),
    ),
  ].slice(0, 3);

  for (const departmentId of liveDepartments) {
    let link = await DepartmentAccessLink.findOne({ departmentId, accessDate: today });
    if (!link) {
      link = await DepartmentAccessLink.create({
        token: generateRawToken(),
        departmentId,
        accessDate: today,
        createdBy: user._id,
      });
    }
    const existing = await LinkRegistrant.countDocuments({
      linkToken: link.token,
      email: { $regex: `${SEED_EMAIL_SUFFIX}$` },
    });
    if (existing === 0) {
      await LinkRegistrant.insertMany([
        {
          linkToken: link.token,
          name: "Fatima Sheikh",
          email: `fatima.sheikh${SEED_EMAIL_SUFFIX}`,
          status: "approved",
          requestedAt: new Date(),
          approvedAt: new Date(),
        },
        {
          linkToken: link.token,
          name: "Omar Farooq",
          email: `omar.farooq.${departmentId.slice(-4)}${SEED_EMAIL_SUFFIX}`,
          status: "pending_approval",
          requestedAt: new Date(),
          approvedAt: null,
        },
      ]);
    }
  }

  const recent = inserted.slice(-8);
  await Notification.insertMany(
    recent.map((application, index) => ({
      type: index % 3 === 0 ? ("interview_completed" as const) : ("new_application" as const),
      title: index % 3 === 0 ? "Interview completed" : "New application",
      body:
        index % 3 === 0
          ? `An interviewer completed interview with ${application.candidateName} for ${application.roleSnapshot.title}.`
          : `${application.candidateName} applied for ${application.roleSnapshot.title}.`,
      refId: application._id.toString(),
      targetRole: "hr" as const,
      isRead: false,
      createdAt: new Date(Date.now() - index * 40 * 60_000),
    })),
  );

  const byStatus = await Application.aggregate<{ _id: string; n: number }>([
    { $match: { candidateEmail: { $regex: `${SEED_EMAIL_SUFFIX}$` } } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);

  console.log(`Seeded ${inserted.length} applications across ${jobs.length} jobs.`);
  console.log(`Interviews today: ${scheduledToday}, tomorrow: ${scheduledTomorrow}.`);
  console.log(
    "Pipeline:",
    Object.fromEntries(byStatus.map((row) => [row._id, row.n])),
  );
}

try {
  await main();
} finally {
  await disconnectFromDatabase();
}
