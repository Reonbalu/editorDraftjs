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

import { getSelectionEntity } from "draftjs-utils";

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

export const EditableDiff4 = () => {
  const contextMenuRef = useRef(null);

  const [newState, setNewState] = useState(
    EditorState.createWithContent(
      ContentState.createFromText(
        "国境の長いトンネルを抜けた。\n　向側の座席から娘が立っていた。\n朝日が上る。"
      )
    )
  );
  const [currentState, setCurrentState] = useState(
    EditorState.createWithContent(
      ContentState.createFromText(
        "国境の短いトンネルを抜け。\n向側の座席から男が立っていた。"
      )
    )
  );
  const [resultState, setResultState] = useState(EditorState.createEmpty());

  // 単語、ブロックの分割による追加
  const modifyBlockInfo = (
    currentContent: ContentState,
    text: string,
    insertSelection: SelectionState,
    splitBlockFlg: boolean
  ) => {
    // 1.ブロックの分割対象か判定
    if (splitBlockFlg) {
      // 1.1.ブロックを指定位置で分割する。
      currentContent = Modifier.splitBlock(currentContent, insertSelection);
    } else {
      // 1.2.テキストを指定位置に追加する。
      currentContent = Modifier.insertText(
        currentContent,
        insertSelection,
        text
      );
    }
    return currentContent;
  };

  // 装飾の追加
  const addEntityInfo = (
    currentContent: ContentState,
    type: string,
    text: string,
    entitySelection: SelectionState
  ) => {
    // 装飾の追加(type に added or removed が設定されている)
    const entityContentState = currentContent.createEntity(
      type, //DraftEntityType
      "MUTABLE", // DraftEntityMutability
      {
        //Object
        text: text
        // diffIdx: fragment.diffBlockIdx
      }
    );

    return (currentContent = Modifier.applyEntity(
      entityContentState, // ContentState
      entitySelection, //SelectionState
      entityContentState.getLastCreatedEntityKey() // string
    ));
  };

  // ContentStateの更新(modifyBlockInfoにて単語の追加。addEntityInfoにて装飾の追加)
  const updateContentState = (
    currentContentState: ContentState,
    type: string,
    text: string,
    blockIndex: number,
    startOffset: number,
    endOffset: number,
    splitBlockFlg: boolean
  ) => {
    const blockArray = currentContentState.getBlocksAsArray();
    const blockKey = blockArray[blockIndex].getKey();

    // 1.addedの場合、modifyBlockInfoにて単語の追加。addEntityInfoにて装飾の追加。
    if (type === "added") {
      // 単語の挿入位置を算出
      const insertSelection = SelectionState.createEmpty(blockKey).merge({
        anchorOffset: startOffset,
        focusOffset: startOffset
      });
      // 装飾の挿入位置を算出
      const entitySelection = SelectionState.createEmpty(blockKey).merge({
        anchorOffset: startOffset,
        focusOffset: endOffset
      });
      // modifyBlockInfoにて単語の追加
      currentContentState = modifyBlockInfo(
        currentContentState,
        text,
        insertSelection,
        splitBlockFlg
      );

      // addEntityInfoにて装飾の追加
      currentContentState = addEntityInfo(
        currentContentState,
        "added",
        text,
        entitySelection
      );
      // 2.removedの場合、addEntityInfoにて装飾の追加。
    } else if (type === "removed" && text.length !== 0) {
      // 装飾の挿入位置を算出
      const entitySelection = SelectionState.createEmpty(blockKey).merge({
        anchorOffset: startOffset,
        focusOffset: endOffset
      });
      // addEntityInfoにて装飾の追加
      currentContentState = addEntityInfo(
        currentContentState,
        "removed",
        text,
        entitySelection
      );
    }
    return currentContentState;
  };

  const createDiffState = (
    newState: EditorState,
    currentEditorState: EditorState
  ) => {
    // 比較対象記事(compareText)と現在編集中記事(currentText)のテキストを取得する。
    const compareText = newState.getCurrentContent().getPlainText("\n");
    const currentText = currentState.getCurrentContent().getPlainText("\n");
    // 現在編集中記事(currentText)をベースに比較する
    const diffBlocks = Diff.diffChars(currentText, compareText);
    console.log("diffBlocks:,", diffBlocks);

    let startOffset = 0;
    let endOffset = 0;
    let blockIndex = 0;
    // 編集中記事のContentStateを取得する。
    let currentContentState = currentState.getCurrentContent();

    // Diffにて生成したdiffBlocksの差分結果より、
    // 1.比較対象記事(added)の情報を編集中記事(currentContentState)に反映する。
    // 2.装飾情報を、編集中記事に設定する(added：比較対象記事のみに存在する単語、removed：編集中記事のみに存在する単語)
    diffBlocks.forEach((block: Diff) => {
      const type = block.added ? "added" : block.removed ? "removed" : "";

      // 1.差分ブロックが改行を含んでいる場合
      if (block.value.includes("\n")) {
        // 1.1.差分ブロックを改行コードで分割して、segmentations配列に格納する。
        const segmentations = block.value.split("\n");
        console.log("segmentations", type, segmentations);

        // 1.2.segmentations配列の件数分、下記処理を実施する。
        // updateContentStateは、addedの場合、単語の追加と装飾。removedの場合は、装飾のみ。
        segmentations.forEach((text: string, index: number) => {
          // 1.2.1.配列の最後の要素でない場合
          //     addedの場合、①Current記事に文章を追加。
          //                 ②splitBlockを使って、指定位置でBlockを2つに分割する。
          if (index !== segmentations.length - 1) {
            endOffset = startOffset + text.length;

            // 複数行の場合は、「改行コード + 文1 + 文2...」という形で連携される(added,removedともに)
            // blockIndexをupdateBlockメソッドに連携することで、指定した位置に本文を追加する。
            currentContentState = updateContentState(
              currentContentState,
              type,
              text,
              blockIndex,
              startOffset,
              endOffset,
              false
            );
            // splitBlockを使って、指定位置でBlockを2つに分割する。
            // startOffsetとendOffsetは同じ位置を指定する必要がある。
            currentContentState = updateContentState(
              currentContentState,
              type,
              text,
              blockIndex,
              startOffset + text.length,
              endOffset,
              true
            );

            console.log(
              "text1:",
              text,
              block.added,
              block.removed,
              blockIndex,
              startOffset,
              endOffset
            );

            // 上記でsplitBlockを使って新しい段落を追加した。
            // よって、startOffset、endOffsetを初期化。
            //        blockIndexを1段落加算する。
            startOffset = 0;
            endOffset = 0;
            blockIndex++;

            // 1.2.ブロックの最終の単語は、テキストのみで出力(改行なし)
          } else {
            endOffset = startOffset + text.length;
            currentContentState = updateContentState(
              currentContentState,
              type,
              text,
              blockIndex,
              startOffset,
              endOffset,
              false
            );
            console.log(
              "text2:",
              text,
              block.added,
              block.removed,
              blockIndex,
              startOffset,
              endOffset
            );
            startOffset = startOffset + text.length;
          }
        });
        // 2.ブロックが改行を含んでいない場合
      } else {
        let text = block.value;
        endOffset = startOffset + text.length;
        currentContentState = updateContentState(
          currentContentState,
          type,
          text,
          blockIndex,
          startOffset,
          endOffset,
          false
        );

        console.log(
          "text:",
          text,
          block.added,
          block.removed,
          blockIndex,
          startOffset,
          endOffset
        );
        startOffset = startOffset + text.length;
      }
    });

    // 装飾(追加、削除)のdecoratorを読み込ませる。
    let newCurrentEditorState = EditorState.createWithContent(
      currentContentState, // ContentState
      decorator // DraftDecoratorType
    );
    // 新しく作成したEditorStateを返却する。
    return EditorState.push(
      newCurrentEditorState, // EditorState
      currentContentState, // ContentState
      "apply-entity" // EditorChangeType
    );
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

    // EditorStateに含まれる全てのblockを取得する。
    content.getBlocksAsArray().forEach((block: any) => {
      let selectedEntity: {
        entityKey: string;
        blockKey: string;
        entity: Draft.EntityInstance;
      } | null = null;

      // blockに含まれるEntityを取得する。最初の処理でフィルタリング、次でcallback関数を実施する。
      block.findEntityRanges(
        (character: any) => {
          // Entityが空でなければ
          if (character.getEntity() != null) {
            const entity = content.getEntity(character.getEntity());

            // EntityのTypeが "added" or "removed" なら
            if (
              entity.getType() === "added" ||
              entity.getType() === "removed"
            ) {
              selectedEntity = {
                entityKey: character.getEntity(),
                blockKey: block.getKey(),
                entity: content.getEntity(character.getEntity())
              };
              // trueを返却して、callback関数を実行
              return true;
            }
          } else {
            // 条件に一致しない場合、falseを返却。callback関数は実行しない。
            return false;
          }
        },
        (start: number, end: number) => {
          // entities配列に、entityKey、blockKey、entity、start、endを設定する
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
      // EntityのentityKeyをnullで更新することで、削除する。
      const newContentState = Modifier.applyEntity(
        contentState,
        entitySelection,
        null // entityKey
      );
      // 既存のeditorStateにnewContentStateを追加し、新しいeditorStateにする。
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
      // EntityのentityKeyをnullで更新することで、削除する。(※新しいContentStateを返却する)
      const removedEntityContentState = Modifier.applyEntity(
        contentState,
        entitySelection,
        null // entityKey
      );
      // 既存のeditorStateにnewContentStateを追加し、新しいeditorStateにする。
      const removedEntityEditorState = EditorState.push(
        resultState,
        removedEntityContentState,
        "apply-entity"
      );
      // EditorStateから、文字列を削除する。削除範囲は、entitySelectionで指定。
      const removedEntityAndTextContentState = Modifier.removeRange(
        removedEntityEditorState.getCurrentContent(),
        entitySelection,
        "forward" // 削除方向
      );
      // EditorStateに、文字列を削除したContentStateの情報より、更新する。
      return EditorState.push(
        removedEntityEditorState,
        removedEntityAndTextContentState,
        "remove-range"
      );
    }
  };

  const reflectAll = (resultState: EditorState) => {
    // EditorStateの全てのEntity情報を取得する。
    const entities = getAllEntities(resultState);
    console.log("entities:", entities);
    let initResultState = resultState;

    // 取得したentity情報より、"added" or "removed" で処理を分岐する
    // ※entityDataは、getAllEntitiesで設定したうちの一つの要素
    entities.forEach((entityData) => {
      console.log("entityData:", entityData);
      // entityのタイプを取得する。
      const type = entityData.entity.getType();
      if (type === "added") {
        // EditorStateから、Entityデータを取得し、Entity情報をnullで更新する。背景色を消す
        initResultState = removeEntity(
          { entityKey: entityData.entityKey, blockKey: entityData.blockKey },
          initResultState
        );
      } else {
        // 1.EditorStateから、Entityデータを取得し、Entity情報をnullで更新する。背景色を消す
        // 2.EntityデータからremoveRangeを使用して、文字列を削除する。
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
        title: "反映",
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

  function getEntities(
    editorState: EditorState,
    entityType = null,
    startBlockKey: string,
    startOffSet: number,
    endBlockKey: string,
    endOffSet: number
  ) {
    const content = editorState.getCurrentContent();
    const entities = [];
    content.getBlocksAsArray().forEach((block) => {
      let selectedEntity: {
        entityKey: string;
        blockKey: string;
        entity: Draft.EntityInstance;
      } | null = null;
      block.findEntityRanges(
        (character) => {
          if (character.getEntity() !== null) {
            const entity = content.getEntity(character.getEntity());
            if (
              !entityType ||
              (entityType && entity.getType() === entityType)
            ) {
              selectedEntity = {
                entityKey: character.getEntity(),
                blockKey: block.getKey(),
                entity: content.getEntity(character.getEntity())
              };
              return true;
            }
          }
          return false;
        },
        (start, end) => {
          let mode = 0;
          if (
            mode === 0 &&
            selectedEntity.blockKey === startBlockKey &&
            startOffSet <= end
          ) {
            mode = 1;
          }
          if (
            mode === 1 &&
            selectedEntity.blockKey === endBlockKey &&
            start <= endOffSet
          ) {
            mode = 2;
          }
          if (mode === 2 && selectedEntity.blockKey !== endBlockKey) {
            mode = 3;
          }
          if (mode === 1 || mode === 2) {
            console.log("hantei:", mode, selectedEntity.blockKey, start, end);
            entities.push({ ...selectedEntity, start, end });
          }
        }
      );
    });
    return entities;
  }

  const handleRightClick = (e: any) => {
    let selectionState = resultState.getSelection();

    console.log(
      "getEntities:",
      getEntities(
        resultState,
        null,
        selectionState.getStartKey(),
        selectionState.getStartOffset(),
        selectionState.getEndKey(),
        selectionState.getEndOffset()
      )
    );

    console.log(
      "getStartKey:",
      selectionState.getStartKey(),
      selectionState.getStartOffset(),
      selectionState.getEndKey(),
      selectionState.getEndOffset()
    );
    // console.log(
    //   "getAnchorKey:",
    //   selectionState.getAnchorKey(), // fhp85 2 1iln7 2
    //   selectionState.getAnchorOffset(),
    //   selectionState.getFocusKey(),
    //   selectionState.getFocusOffset()
    // );

    const keys = getEntityKey(e.target);
    console.log("handleRightClick", keys);
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
          差分比較
        </Button>
        <Button variant="contained" onMouseDown={() => reflectAll(resultState)}>
          一括反映
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
