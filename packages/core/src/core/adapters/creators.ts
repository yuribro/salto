/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Adapter } from '@salto-io/adapter-api'
import { adapter as salesforceAdapter } from '@salto-io/salesforce-adapter'
import { adapter as netsuiteAdapter } from '@salto-io/netsuite-adapter'
import { adapter as dummyAdapter } from '@salto-io/dummy-adapter'
import { adapter as workatoAdapter } from '@salto-io/workato-adapter'
import { adapter as zendeskAdapter } from '@salto-io/zendesk-adapter'
import { adapter as zuoraBillingAdapter } from '@salto-io/zuora-billing-adapter'
import { adapter as jiraAdapter } from '@salto-io/jira-adapter'
import { adapter as stripeAdapter } from '@salto-io/stripe-adapter'
import { adapter as oktaAdapter } from '@salto-io/okta-adapter'
import { adapter as sapAdapter } from '@salto-io/sap-adapter'
import { adapter as intercomAdapter } from '@salto-io/intercom-adapter'
import { adapter as serviceplaceholderAdapter } from '@salto-io/serviceplaceholder-adapter'
import { adapter as googleWorkspaceAdapter } from '@salto-io/google-workspace-adapter'
import { adapter as confluenceAdapter } from '@salto-io/confluence-adapter'
import { adapter as microsoftEntra } from '@salto-io/microsoft-entra-adapter'
import { adapter as pagerDutyAdapter } from '@salto-io/pagerduty-adapter'

const adapterCreators: Record<string, Adapter> = {
  salesforce: salesforceAdapter,
  netsuite: netsuiteAdapter,
  workato: workatoAdapter,
  sap: sapAdapter,
  stripe: stripeAdapter,
  zuora_billing: zuoraBillingAdapter,
  zendesk: zendeskAdapter,
  jira: jiraAdapter,
  okta: oktaAdapter,
  dummy: dummyAdapter,
  serviceplaceholder: serviceplaceholderAdapter,
  google_workspace: googleWorkspaceAdapter,
  confluence: confluenceAdapter,
  intercom: intercomAdapter,
  microsoft_entra: microsoftEntra,
  pagerduty: pagerDutyAdapter,
}

export default adapterCreators
