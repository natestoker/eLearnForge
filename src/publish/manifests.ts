// Package descriptor templates. Kept minimal and standards-conformant:
// one organization, one SCO/activity, launch href index.html. This shape
// resolves correctly in SCORM Cloud and in item-identifierref -> resource
// href viewers (including natestoker.com/scorm-viewer.html).

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slug(s: string): string {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'course';
}

export function scorm12Manifest(title: string): string {
  const id = slug(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}-manifest" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${id}-org">
    <organization identifier="${id}-org">
      <title>${esc(title)}</title>
      <item identifier="${id}-item" identifierref="${id}-resource">
        <title>${esc(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${id}-resource" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>
`;
}

export function scorm2004Manifest(title: string): string {
  const id = slug(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}-manifest" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                      http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                      http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                      http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                      http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="${id}-org">
    <organization identifier="${id}-org">
      <title>${esc(title)}</title>
      <item identifier="${id}-item" identifierref="${id}-resource">
        <title>${esc(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${id}-resource" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>
`;
}

export function tincanXml(title: string, activityId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities>
    <activity id="${esc(activityId)}" type="http://adlnet.gov/expapi/activities/course">
      <name>${esc(title)}</name>
      <description lang="en-US">${esc(title)} - published with eLearnForge</description>
      <launch lang="en-US">index.html</launch>
    </activity>
  </activities>
</tincan>
`;
}

export function activityIdFor(title: string): string {
  return `https://elearnforge.local/course/${slug(title)}`;
}
