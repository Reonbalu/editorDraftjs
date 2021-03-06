import "./styles.css";
import { Box, Button, Card } from "@mui/material";
import * as Diff from "diff";
import Draft, {
  CompositeDecorator,
  ContentBlock,
  ContentState,
  Editor,
  EditorState,
  Modifier,
  SelectionState,
  convertToRaw,
  RichUtils
} from "draft-js";
import { useCallback, useRef, useState } from "react";
import { ContextMenu } from "./ContextMenu";
import { ConnectingAirportsOutlined } from "@mui/icons-material";
import * as Immutable from "immutable";

export const styleMap = {
  bold: {
    fontWeight: "bold"
  },
  orange: {
    color: "rgba(255, 127, 0, 1.0)"
  }
};

const AddText = (props: EditorState) => {
  return (
    <span
      className={"added-text"}
      data-entity-key={props.entityKey}
      data-block-key={props.blockKey}
    >
      {props.children}
    </span>
  );
};

const RemoveText = (props: EditorState) => {
  return (
    <span
      className={"removed-text"}
      data-entity-key={props.entityKey}
      data-block-key={props.blockKey}
    >
      {props.children}
    </span>
  );
};

const findAddedText = (
  contentBlock: ContentBlock,
  callback: any,
  constentState: ContentState
) => {
  contentBlock.findEntityRanges((character: any) => {
    const entityKey = character.getEntity();
    return (
      entityKey !== null &&
      constentState.getEntity(entityKey).getType() === "added"
    );
  }, callback);
};

const findRemovedText = (
  contentBlock: ContentBlock,
  callback: any,
  constentState: ContentState
) => {
  contentBlock.findEntityRanges((character: any) => {
    const entityKey = character.getEntity();
    return (
      entityKey !== null &&
      constentState.getEntity(entityKey).getType() === "removed"
    );
  }, callback);
};

const decorator = new CompositeDecorator([
  {
    strategy: findAddedText,
    component: AddText
  },
  {
    strategy: findRemovedText,
    component: RemoveText
  }
]);

export const EditableDiff2 = () => {
  const contextMenuRef = useRef(null);

  const [newState, setNewState] = useState(
    EditorState.createWithContent(
      ContentState.createFromText(
        "??????????????????????????????????????????\n????????????????????????????????????????????????\n??????????????????"
      )
    )
  );
  const [currentState, setCurrentState] = useState(
    EditorState.createWithContent(
      ContentState.createFromText(
        "???????????????????????????????????????\n?????????????????????????????????????????????"
      )
    )
  );
  const [resultState, setResultState] = useState(EditorState.createEmpty());

  const editorToDiffEditor = (oldEditor: EditorState, diff: any) => {
    let currentContentState = oldEditor.getCurrentContent();
    diff.forEach((fragment: any) => {
      if (fragment.value !== "\n" && (fragment.added || fragment.removed)) {
        const blockArray = currentContentState.getBlocksAsArray();
        const blockKey = blockArray[fragment.blockIndex].getKey();
        const type = fragment.added ? "added" : "removed";
        const selection = SelectionState.createEmpty(blockKey).merge({
          anchorOffset: fragment.start,
          focusOffset: fragment.end
        });

        console.log(fragment);
        const entityContentState = currentContentState.createEntity(
          type, //DraftEntityType
          "MUTABLE", // DraftEntityMutability
          {
            //Object
            text: fragment.value
            // diffIdx: fragment.diffBlockIdx
          }
        );
        const entityKey = entityContentState.getLastCreatedEntityKey();

        currentContentState = Modifier.applyEntity(
          entityContentState, // ContentState
          selection, //SelectionState
          entityKey // string
        );
      }
    });

    let newCurrentEditorState = EditorState.createWithContent(
      currentContentState, // ContentState
      decorator // DraftDecoratorType
    );
    return EditorState.push(
      newCurrentEditorState, // EditorState
      currentContentState, // ContentState
      "apply-entity" // EditorChangeType
    );
  };

  const createDiffState = (
    newState: EditorState,
    currentState: EditorState
  ) => {
    const newText = newState.getCurrentContent().getPlainText("\n");
    const currentText = currentState.getCurrentContent().getPlainText("\n");
    // ??????????????????????????????????????????
    const diffBlocks = Diff.diffChars(currentText, newText);
    console.log("diffBlocks:,", diffBlocks);

    const fragmentsWithIndex: Array<String>[] = [];
    let offset = 0;
    let blockIndex = 0;
    diffBlocks.forEach((block: Diff) => {
      // 1.?????????????????????????????????????????????
      if (block.value.includes("\n")) {
        const segmentations = block.value.split("\n");
        segmentations.forEach((text: string, index: number) => {
          // 1.1.???????????????????????????????????????????????? + ???????????????
          if (index !== segmentations.length - 1) {
            fragmentsWithIndex.push(
              {
                ...block,
                count: text.length,
                value: text,
                blockIndex,
                start: offset,
                end: offset + text.length
              },
              {
                ...block,
                count: 1,
                value: "\n",
                blockIndex,
                start: offset + text.length,
                end: offset + text.length
              }
            );
            console.log(
              "text1:",
              text,
              blockIndex,
              offset,
              offset + text.length
            );

            offset = 0;
            blockIndex++;
            // 1.2.???????????????????????????????????????????????????????????????(????????????)
          } else {
            fragmentsWithIndex.push({
              ...block,
              count: text.length,
              value: text,
              blockIndex,
              start: offset,
              end: offset + text.length
            });
            console.log(
              "text2:",
              text,
              blockIndex,
              offset,
              offset + text.length
            );
            offset = offset + text.length;
          }
        });
        // 2.????????????????????????????????????????????????
      } else {
        // 2.1.????????????????????????????????????????????????
        let text = block.value;
        fragmentsWithIndex.push({
          ...block,
          count: text.length,
          value: text,
          blockIndex,
          start: offset,
          end: offset + text.length
        });
        console.log("text:", text, blockIndex, offset, offset + text.length);
        offset = offset + text.length;
      }
    });
    console.log("fragments:", ...fragmentsWithIndex);

    // // ??????????????????????????????????????????????????????????????????????????????
    // const article = fragments.reduce((pre: Diff, cur: Diff) => {
    //   return pre + cur.value;
    // }, "");
    // console.log("article:", article);

    // let index = 0;
    // let blockIndex = 0;
    // const fragmentsWithIndex = fragments.map((fragment: Diff) => {
    //   if (fragment.value === "\n") {
    //     const newLinebreakBlock = {
    //       ...fragment,
    //       blockIndex,
    //       start: index,
    //       end: index
    //     };
    //     index = 0;
    //     blockIndex++;
    //     return newLinebreakBlock;
    //   } else {
    //     const start = index;
    //     const end = fragment.value.length + index;
    //     index = end;

    //     return {
    //       ...fragment,
    //       blockIndex,
    //       start,
    //       end
    //     };
    //   }
    // });
    // console.log("fragmentsWithIndex:", fragmentsWithIndex);

    // let nextContent = nextEditorState.getCurrentContent();
    let currentContent = currentState.getCurrentContent();
    fragmentsWithIndex.forEach((fragment: any) => {
      if (fragment.added && fragment.value.length !== 0) {
        const blockArray = currentContent.getBlocksAsArray();
        console.log(
          "fragment.blockIndex:",
          fragment.blockIndex,
          blockArray[fragment.blockIndex]
        );
        const blockKey = blockArray[fragment.blockIndex].getKey();
        const selection = SelectionState.createEmpty(blockKey).merge({
          anchorOffset: fragment.start,
          focusOffset: fragment.start
        });
        if (fragment.value === "\n") {
          const newCurrentContent = Modifier.splitBlock(
            currentContent,
            selection
          );

          const blockMap = Immutable.Map({ orgData: fragment });
          currentContent = Modifier.setBlockData(
            newCurrentContent,
            selection,
            blockMap
          );
        } else {
          currentContent = Modifier.insertText(
            currentContent,
            selection,
            fragment.value
          );
        }
      }
    });

    currentState = EditorState.set(currentState, {
      currentContent: currentContent
    });
    console.log("fragmentsWithIndex:", fragmentsWithIndex);

    return editorToDiffEditor(currentState, fragmentsWithIndex);
  };

  const generateDiff = () => {
    const newEditorState = createDiffState(newState, currentState);
    setResultState(newEditorState);
  };

  const getAllEntities = (resultState: EditorState) => {
    const content = resultState.getCurrentContent();
    const entities: {
      start: number;
      end: number;
      entityKey?: string | undefined;
      blockKey?: string | undefined;
      entity?: Draft.EntityInstance | undefined;
    }[] = [];

    // EditorState????????????????????????block??????????????????
    content.getBlocksAsArray().forEach((block: any) => {
      let selectedEntity: {
        entityKey: string;
        blockKey: string;
        entity: Draft.EntityInstance;
      } | null = null;

      // block???????????????Entity??????????????????????????????????????????????????????????????????callback????????????????????????
      block.findEntityRanges(
        (character: any) => {
          // Entity?????????????????????
          if (character.getEntity() != null) {
            const entity = content.getEntity(character.getEntity());

            // Entity???Type??? "added" or "removed" ??????
            if (
              entity.getType() === "added" ||
              entity.getType() === "removed"
            ) {
              selectedEntity = {
                entityKey: character.getEntity(),
                blockKey: block.getKey(),
                entity: content.getEntity(character.getEntity())
              };
              // true??????????????????callback???????????????
              return true;
            }
          } else {
            // ?????????????????????????????????false????????????callback???????????????????????????
            return false;
          }
        },
        (start: number, end: number) => {
          // entities????????????entityKey???blockKey???entity???start???end???????????????
          // 1.entityKey : 45eec324-87ba-4166-97be-958d6efdcae5
          // 2.blockKey: "7i9ak"
          // 3.entity : Object
          // 4.start : 13
          // 5.end : 14
          entities.push({ ...selectedEntity, start, end });
        }
      );
    });
    return entities;
  };

  const removeEntity = (keys: any, resultState: EditorState) => {
    const { entityKey, blockKey } = keys;
    const contentState = resultState.getCurrentContent();
    const selectionState = SelectionState.createEmpty(blockKey);
    const contentBlock = contentState.getBlockForKey(blockKey);
    // console.log("contentBlock:", contentBlock.getText());

    let entitySelection = null;
    contentBlock.findEntityRanges(
      (character: any) => character.getEntity() === entityKey,
      (start: number, end: number) => {
        entitySelection = selectionState.merge({
          anchorOffset: start,
          focusOffset: end
        });
      }
    );
    console.log("entitySelection:", entitySelection);

    if (entitySelection) {
      // Entity???entityKey???null??????????????????????????????????????????
      const newContentState = Modifier.applyEntity(
        contentState,
        entitySelection,
        null // entityKey
      );
      // ?????????editorState???newContentState????????????????????????editorState????????????
      return EditorState.push(resultState, newContentState, "apply-entity");
    }
  };

  const removeEntityAndText = (keys: any, resultState: EditorState) => {
    const { entityKey, blockKey } = keys;
    const contentState = resultState.getCurrentContent();
    const selectionState = SelectionState.createEmpty(blockKey);
    const contentBlock = contentState.getBlockForKey(blockKey);

    let entitySelection = null;
    contentBlock.findEntityRanges(
      (character: any) => character.getEntity() === entityKey,
      (start: number, end: number) => {
        entitySelection = selectionState.merge({
          anchorOffset: start,
          focusOffset: end
        });
      }
    );
    if (entitySelection) {
      // Entity???entityKey???null??????????????????????????????????????????(????????????ContentState???????????????)
      const removedEntityContentState = Modifier.applyEntity(
        contentState,
        entitySelection,
        null // entityKey
      );
      // ?????????editorState???newContentState????????????????????????editorState????????????
      const removedEntityEditorState = EditorState.push(
        resultState,
        removedEntityContentState,
        "apply-entity"
      );
      // EditorState??????????????????????????????????????????????????????entitySelection????????????
      const removedEntityAndTextContentState = Modifier.removeRange(
        removedEntityEditorState.getCurrentContent(),
        entitySelection,
        "forward" // ????????????
      );
      // EditorState??????????????????????????????ContentState?????????????????????????????????
      return EditorState.push(
        removedEntityEditorState,
        removedEntityAndTextContentState,
        "remove-range"
      );
    }
  };

  const reflectAll = (resultState: EditorState) => {
    // EditorState????????????Entity????????????????????????
    const entities = getAllEntities(resultState);
    console.log("entities:", entities);
    let initResultState = resultState;

    // ????????????entity???????????????"added" or "removed" ????????????????????????
    // ???entityData??????getAllEntities???????????????????????????????????????
    entities.forEach((entityData) => {
      console.log(entityData);
      // entity??????????????????????????????
      const type = entityData.entity.getType();
      if (type === "added") {
        // EditorState?????????Entity????????????????????????Entity?????????null????????????????????????????????????
        initResultState = removeEntity(
          { entityKey: entityData.entityKey, blockKey: entityData.blockKey },
          initResultState
        );
      } else {
        // 1.EditorState?????????Entity????????????????????????Entity?????????null????????????????????????????????????
        // 2.Entity???????????????removeRange?????????????????????????????????????????????
        initResultState = removeEntityAndText(
          { entityKey: entityData.entityKey, blockKey: entityData.blockKey },
          initResultState
        );
      }

      if (initResultState !== resultState) {
        setResultState(initResultState);
      }
    });
  };

  const changeNewState = (newEditorState: EditorState) => {
    setNewState(newEditorState);
  };
  const changeCurrentState = (newEditorState: EditorState) => {
    setCurrentState(newEditorState);
  };
  const changeResultState = (newEditorState: EditorState) => {
    setResultState(newEditorState);
  };

  const convertResult = (resultState: EditorState) => {
    const data = convertToRaw(resultState.getCurrentContent());
    console.log(JSON.stringify(data));
  };

  const menuGenerator = (keys: any) => {
    const { entityKey } = keys;
    const contentState = resultState.getCurrentContent();

    const entity = contentState.getEntity(entityKey);
    const type = entity.getType();
    return [
      {
        id: 0,
        title: "??????",
        hide: false,
        disabled: false,
        onClick: () => {
          const newState =
            type === "added"
              ? removeEntity(keys, resultState)
              : removeEntityAndText(keys, resultState);
          if (newState) {
            setResultState(newState);
          }
        }
      }
    ];
  };

  const getEntityKey = useCallback((element: HTMLElement) => {
    let e = element;
    let entityKey = "";
    let blockKey = "";
    while (e.id !== "result-editor" && e.id !== "root") {
      if (e.dataset.entityKey && e.dataset.blockKey) {
        entityKey = e.dataset.entityKey;
        blockKey = e.dataset.blockKey;
        break;
      }
      e = e.parentElement as HTMLElement;
    }
    return { entityKey, blockKey };
  }, []);

  const handleRightClick = (e: any) => {
    console.log("aaa");
    const keys = getEntityKey(e.target);
    if (keys.entityKey.length > 0) {
      e.preventDefault();
      // @ts-ignore
      contextMenuRef.current.openContextmenu(e, keys);
    } else {
      e.preventDefault();
    }
  };

  const onBoldClick = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    setCurrentState(RichUtils.toggleInlineStyle(currentState, "BOLD"));
  };

  return (
    <Box sx={{ display: "grid", gridGap: "10px" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "100px 100px 100px 100px",
          gridGap: "10px"
        }}
      >
        <Button variant="contained" onMouseDown={() => generateDiff()}>
          ????????????
        </Button>
        <Button variant="contained" onMouseDown={() => reflectAll(resultState)}>
          ????????????
        </Button>
        <Button
          variant="contained"
          onMouseDown={() => convertResult(resultState)}
        >
          JSON
        </Button>
        <Button variant="outlined" onMouseDown={onBoldClick}>
          Bold
        </Button>
      </Box>
      <ContextMenu ref={contextMenuRef} itemsGenerator={menuGenerator} />
      <Box
        sx={{
          height: "250px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridGap: "10px"
        }}
      >
        <Card>
          <div
            style={{ backgroundColor: "blue", padding: "5px", color: "white" }}
          >
            New
          </div>
          <Editor editorState={newState} onChange={changeNewState} />
        </Card>
        <Card>
          <div
            style={{ backgroundColor: "green", padding: "5px", color: "white" }}
          >
            Current
          </div>
          <Editor
            customStyleMap={styleMap}
            editorState={currentState}
            onChange={changeCurrentState}
          />
        </Card>
        <Card>
          <div
            style={{
              backgroundColor: "#D53F8C",
              padding: "5px",
              color: "white"
            }}
          >
            Result
          </div>
          <div style={{ height: "100%" }} onContextMenu={handleRightClick}>
            <Editor
              customStyleMap={styleMap}
              editorState={resultState}
              onChange={changeResultState}
            />
          </div>
        </Card>
      </Box>
    </Box>
  );
};
