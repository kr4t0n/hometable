{{- define "hometable.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "hometable.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "hometable.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{ include "hometable.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "hometable.selectorLabels" -}}
app.kubernetes.io/name: {{ include "hometable.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "hometable.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "hometable.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "hometable.backendImage" -}}
{{- printf "%s:%s" .Values.image.backend.repository (default .Chart.AppVersion .Values.image.backend.tag) -}}
{{- end -}}

{{- define "hometable.frontendImage" -}}
{{- printf "%s:%s" .Values.image.frontend.repository (default .Chart.AppVersion .Values.image.frontend.tag) -}}
{{- end -}}

{{/* Postgres Secret name + key (existing or chart-managed) */}}
{{- define "hometable.dbSecretName" -}}
{{- if .Values.postgres.existingSecret -}}
{{- .Values.postgres.existingSecret -}}
{{- else -}}
{{- printf "%s-db" (include "hometable.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "hometable.dbSecretKey" -}}
{{- if .Values.postgres.existingSecret -}}
{{- .Values.postgres.existingSecretKey -}}
{{- else -}}
DATABASE_URL
{{- end -}}
{{- end -}}

{{/* S3 Secret name (existing or chart-managed). Keys default to S3_ACCESS_KEY_ID /
     S3_SECRET_ACCESS_KEY but can be overridden for an existing Secret. */}}
{{- define "hometable.s3SecretName" -}}
{{- if .Values.s3.existingSecret -}}
{{- .Values.s3.existingSecret -}}
{{- else -}}
{{- printf "%s-s3" (include "hometable.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* Key inside the S3 Secret holding the access key id. Overridable only for an
     existing Secret; the chart-managed Secret always uses S3_ACCESS_KEY_ID. */}}
{{- define "hometable.s3AccessKeyKey" -}}
{{- if .Values.s3.existingSecret -}}
{{- default "S3_ACCESS_KEY_ID" .Values.s3.existingSecretAccessKeyKey -}}
{{- else -}}
S3_ACCESS_KEY_ID
{{- end -}}
{{- end -}}

{{/* Key inside the S3 Secret holding the secret access key. */}}
{{- define "hometable.s3SecretKeyKey" -}}
{{- if .Values.s3.existingSecret -}}
{{- default "S3_SECRET_ACCESS_KEY" .Values.s3.existingSecretSecretKeyKey -}}
{{- else -}}
S3_SECRET_ACCESS_KEY
{{- end -}}
{{- end -}}
