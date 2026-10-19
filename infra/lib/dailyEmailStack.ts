import * as path from 'path';
import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import { Schedule, ScheduleExpression } from 'aws-cdk-lib/aws-scheduler';
import { LambdaInvoke } from 'aws-cdk-lib/aws-scheduler-targets';

export interface DailyEmailStackProps extends StackProps {
  /** Address the email comes from. SES sends it a verification link. */
  fromAddress: string;
  /** Public app URL, used for links in the email. */
  appUrl: string;
  supabaseUrl: string;
  /**
   * Secrets Manager secret (created by hand, so values never pass through
   * CloudFormation) holding SUPABASE_SERVICE_ROLE_KEY and
   * OPENWEATHERMAP_API_KEY as JSON.
   */
  secretName: string;
}

/**
 * Every 15 minutes, EventBridge Scheduler runs a Lambda that emails each
 * opted-in user whose local send time has passed, through SES.
 */
export class DailyEmailStack extends Stack {
  constructor(scope: Construct, id: string, props: DailyEmailStackProps) {
    super(scope, id, props);

    const identity = new EmailIdentity(this, 'SenderIdentity', {
      identity: Identity.email(props.fromAddress),
    });

    const secret = Secret.fromSecretNameV2(this, 'Secrets', props.secretName);

    const logGroup = new LogGroup(this, 'SenderLogs', { retention: RetentionDays.ONE_MONTH });

    const repoRoot = path.join(__dirname, '..', '..');
    const fn = new NodejsFunction(this, 'Sender', {
      entry: path.join(__dirname, '..', 'lambda', 'dailyEmail.ts'),
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.minutes(2),
      // One run at a time, so overlapping schedules can't race.
      reservedConcurrentExecutions: 1,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      bundling: {
        // Resolves the app's "@/..." imports to ../src.
        tsconfig: path.join(__dirname, '..', 'tsconfig.json'),
        minify: true,
        sourceMap: true,
        // Bundle the AWS SDK too, rather than rely on the runtime's copy.
        externalModules: [],
      },
      environment: {
        FROM_ADDRESS: props.fromAddress,
        APP_URL: props.appUrl,
        SUPABASE_URL: props.supabaseUrl,
        SECRET_ID: props.secretName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      logGroup,
    });

    secret.grantRead(fn);
    identity.grantSendEmail(fn);

    new Schedule(this, 'Every15Minutes', {
      description: 'Send FitFinder daily emails that are due',
      schedule: ScheduleExpression.rate(Duration.minutes(15)),
      target: new LambdaInvoke(fn, { retryAttempts: 0 }),
    });

    // For `aws lambda invoke` and finding the logs (see infra/README.md).
    new CfnOutput(this, 'SenderFunctionName', { value: fn.functionName });
    new CfnOutput(this, 'SenderLogGroupName', { value: logGroup.logGroupName });
  }
}
