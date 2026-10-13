#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { DailyEmailStack } from '../lib/dailyEmailStack';

const app = new App();

function required(key: string): string {
  const value = app.node.tryGetContext(key);
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Set "${key}" in infra/cdk.json or pass -c ${key}=...`);
  }
  return value;
}

new DailyEmailStack(app, 'FitFinderDailyEmail', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  fromAddress: required('fromAddress'),
  appUrl: required('appUrl').replace(/\/+$/, ''),
  supabaseUrl: required('supabaseUrl'),
  secretName: required('secretName'),
});
