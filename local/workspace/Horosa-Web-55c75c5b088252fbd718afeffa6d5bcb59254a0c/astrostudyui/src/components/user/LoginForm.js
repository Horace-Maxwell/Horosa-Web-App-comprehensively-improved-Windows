import { Component } from 'react';
import { Form, Input, Button, Select, DatePicker,  Row, Col,  } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { preventEnterPress } from '../../utils/helper';
import { EmailRegex } from '../../utils/constants'

export default function LoginForm(props){
	const [form] = Form.useForm();
    const FormItem = Form.Item;
    const Option = Select.Option;

    function formFieldsChanged(changedFields, allFields){
        if(props.onFieldsChange){
            let values = {
                loginFields: {
                    ...props.fields, 
                },
            };
			for(let fld of allFields){
				let key = fld.name[0];
				values.loginFields[key].value = fld.value;
			}

            if(props.dispatch){
                props.dispatch({
                    type: 'app/save',
                    payload:{ 
                        ...values,
                    },
                });    
            }
        }
	}
	
   function handleSubmit(values){
        if(props.dispatch){
            props.dispatch({
                type: 'app/login',
                payload:{ 
                    ...values,
                },
            });
        }
	}

    function doSubmit(e){

    }
	
	return (
		<div>
			<Form onFinish={handleSubmit} onKeyPress={preventEnterPress}
                onFieldsChange={formFieldsChanged}
                fields={props.fieldsAry}
                form={form}
            >
                <FormItem 
                    name='loginId'
                    rules={[{ 
                        required: true, 
                        message: '请输入您登录名' 
                    }]}
                >
                    <Input prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="登录名" />

				</FormItem>
				
				<FormItem 
                    name='pwd'
                    rules={[{ 
                        required: true, 
                        message: '请输入您的密码！' 
                    }]}
                >
                    <Input prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} type="password" placeholder="密码" onPressEnter={doSubmit} />
				</FormItem>

				<FormItem>
					<Button type="primary" htmlType="submit">
						登&nbsp;录
					</Button>
				</FormItem>

			</Form>
		</div>
	);
    
}

