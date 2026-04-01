import Frame2545 from "@/views/Frame2545";
import Frame2599 from "@/views/Frame2599";
import Frame2342 from "@/views/Frame2342";
import Frame2177 from "@/views/Frame2177";
import Frame21 from "@/views/Frame21";

export const routes = [{
          path: "/frame2545",
          component: Frame2545,
          guid: "2:545",
        },
{
          path: "/frame2599",
          component: Frame2599,
          guid: "2:599",
        },
{
          path: "/frame2342",
          component: Frame2342,
          guid: "2:342",
        },
{
          path: "/frame2177",
          component: Frame2177,
          guid: "2:177",
        },
{
          path: "/",
          component: Frame21,
          guid: "2:1",
        }];


export const guidPathMap = new Map(
  routes.map((item) => [item.guid, item.path])
);
export const pathGuidMap = new Map(
  routes.map((item) => [item.path, item.guid])
);

export const getPathByGuid = (guid: string) => {
  return guidPathMap.get(guid) || "";
};

export const getGuidByPath = (path: string) => {
  return pathGuidMap.get(path) || "";
};
