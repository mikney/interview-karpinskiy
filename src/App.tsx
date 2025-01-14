import React, { useEffect, useState } from 'react';
import './App.css';
import { Button, Form, Input, Modal, Tree } from 'antd';
import axios, { AxiosError } from 'axios';
import { DataNode } from 'antd/es/tree';
import { MdDeleteForever } from 'react-icons/md';
import { MdOutlineEdit } from 'react-icons/md';
import { IoAddCircleOutline } from 'react-icons/io5';
import { toast } from 'react-toastify';

const treeName = '123e4567-e89b-12d3-a456-426614174001';

function handleError(message = 'Unexpected error') {
    toast.error(message);
}
interface TreeItem {
    id: number;
    name: string;
    children?: TreeItem[];
}
interface TreeData extends DataNode, TreeItem {
    path: string;
    children: TreeData[];
}

const getTreeDataReq = async () => {
    try {
        const resp = await axios.post<TreeItem>(`https://test.vmarmysh.com/api.user.tree.get?treeName=${treeName}`);
        function recurse(item: TreeItem, index: string): TreeData {
            const preparedData = {
                key: item.id,
                path: index,
                title: index === 'root' ? 'Root' : item.name,
            };
            if (item.children?.length) {
                return {
                    ...item,
                    ...preparedData,
                    children: item.children.map((item, innerIndex) => recurse(item, index + `-${innerIndex}`)),
                };
            } else {
                return {
                    ...item,
                    ...preparedData,
                    children: [],
                };
            }
        }
        return recurse(resp.data, 'root');
    } catch (e) {
        const error = e as AxiosError;
        handleError((error.response?.data as { message?: string })?.message);
        return null;
    }
};

function getChangedData(data: TreeData, selectedNode: TreeData, caseType: 'delete' | 'change'): TreeData {
    const elem = selectedNode?.path
        .split('-')
        .slice(1, caseType === 'delete' ? -1 : undefined)
        .reduce((acc, item) => {
            return acc!.children[item as unknown as number];
        }, data);
    switch (caseType) {
        case 'change': {
            elem.title = elem.name;
            break;
        }
        case 'delete': {
            elem!.children = elem!.children.filter((item) => item.id !== selectedNode.id);
            break;
        }
    }
    return { ...data };
}

function App() {
    const [treeData, setTreeData] = useState<TreeData | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isRenameModalOpen, setRenameModalOpen] = useState(false);
    const [isNewNodeModalOpen, setNewNodeModalOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<TreeData | null>(null);

    const [nodeNameText, setNodeNameText] = useState('');

    useEffect(() => {
        getTreeDataReq().then(setTreeData);
    }, []);

    useEffect(() => {
        if (isRenameModalOpen) {
            setNodeNameText(selectedNode!.name);
        }
    }, [isRenameModalOpen]);

    async function addNode() {
        try {
            await axios.post(
                `https://test.vmarmysh.com/api.user.tree.node.create?treeName=${treeName}&parentNodeId=${
                    selectedNode!.key as string
                }&nodeName=${nodeNameText}
`
            );
            getTreeDataReq().then(setTreeData);
        } catch (e) {
            const error = e as AxiosError;
            handleError((error.response?.data as { data: { message?: string } })?.data?.message);
        }
    }

    async function changeNodeName() {
        try {
            await axios.post(
                `https://test.vmarmysh.com/api.user.tree.node.rename?treeName=${treeName}&nodeId=${
                    selectedNode!.key as string
                }&newNodeName=${nodeNameText}`
            );
            selectedNode!.name = nodeNameText;
            const data = getChangedData(treeData!, selectedNode!, 'change');
            setTreeData(data);
        } catch (e) {
            const error = e as AxiosError;
            handleError((error.response?.data as { data: { message?: string } })?.data?.message);
        }
    }

    async function deleteNode() {
        try {
            await axios.post(
                `https://test.vmarmysh.com/api.user.tree.node.delete?treeName=${treeName}&nodeId=${selectedNode!.key as string}`
            );
            const data = getChangedData(treeData!, selectedNode!, 'delete');
            setTreeData(data);
        } catch (e) {
            const error = e as AxiosError;
            handleError((error.response?.data as { data: { message?: string } })?.data?.message);
        }
    }
    return (
        <>
            <Tree
                treeData={treeData ? [treeData] : []}
                defaultExpandAll
                onSelect={(_, info) => {
                    setSelectedNode(info.selectedNodes?.length ? info.selectedNodes[0] : null);
                }}
                selectedKeys={selectedNode ? [selectedNode.key] : undefined}
                blockNode
                titleRender={(item) => {
                    const title = item.title as React.ReactNode;
                    const isRoot = item.path === 'root';
                    return (
                        <div>
                            <div>
                                {title}
                                {selectedNode?.id === item.id && (
                                    <span onClick={(event) => event.stopPropagation()}>
                                        <Button onClick={() => setNewNodeModalOpen(true)} type={'link'} size={'small'}>
                                            <IoAddCircleOutline size={20} />
                                        </Button>
                                        {!isRoot && (
                                            <>
                                                <Button onClick={() => setRenameModalOpen(true)} type={'link'} size={'small'}>
                                                    <MdOutlineEdit size={20} />
                                                </Button>
                                                <Button onClick={() => setDeleteModalOpen(true)} type={'link'} size={'small'}>
                                                    <MdDeleteForever size={20} />
                                                </Button>
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                }}
            />

            <Modal
                open={isDeleteModalOpen}
                title={'Delete'}
                onOk={() => {
                    deleteNode();
                    setDeleteModalOpen(false);
                }}
                onCancel={() => {
                    setDeleteModalOpen(false);
                }}>
                Do you want to delete {selectedNode?.title as string}?
            </Modal>
            <Modal
                title={'Rename'}
                okText={'Rename'}
                open={isRenameModalOpen}
                onOk={() => {
                    changeNodeName();
                    setRenameModalOpen(false);
                    setNodeNameText('');
                }}
                onCancel={() => {
                    setRenameModalOpen(false);
                    setNodeNameText('');
                }}>
                <Form.Item
                    layout='vertical'
                    label='New node name'
                    rules={[{ required: true }]}
                    labelCol={{ span: 24 }}
                    wrapperCol={{ span: 24 }}>
                    <Input value={nodeNameText} onChange={(e) => setNodeNameText(e.target.value)} />
                </Form.Item>
            </Modal>
            <Modal
                title={'Add'}
                okText={'Add'}
                open={isNewNodeModalOpen}
                onOk={() => {
                    addNode();
                    setNewNodeModalOpen(false);
                    setNodeNameText('');
                }}
                onCancel={() => {
                    setNewNodeModalOpen(false);
                    setNodeNameText('');
                }}>
                <Form.Item
                    layout='vertical'
                    label='Node name'
                    rules={[{ required: true }]}
                    labelCol={{ span: 24 }}
                    wrapperCol={{ span: 24 }}>
                    <Input value={nodeNameText} onChange={(e) => setNodeNameText(e.target.value)} />
                </Form.Item>
            </Modal>
        </>
    );
}

export default App;
